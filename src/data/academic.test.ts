import { describe, expect, it } from 'vitest';
import {
  calculateDeletionPolicy,
  getCompletionCreditFloor,
  getCurriculumYear,
  getSecondaryCurriculumYear,
  GRADES,
  normalizeGrade,
  prepareCoursesForDeletion,
  type StudentAcademic,
} from './academic';
import type { Course } from '../domain/types';

function student(overrides: Partial<StudentAcademic> = {}): StudentAcademic {
  return {
    entryYear: 2023,
    admissionType: 'freshman',
    registeredSemesters: 7,
    enrollmentStatus: 'enrolled',
    primaryDepartmentId: 'cs',
    secondaryDepartmentId: null,
    secondarySelectionYear: null,
    deletionRound: 'first',
    baselineEarnedCredits: 105,
    priorPendingDeletionCredits: 0,
    ...overrides,
  };
}

describe('공식 교육과정 적용 연도', () => {
  it('신입은 입학연도, 확인된 교육과정 변경은 명시 연도를 사용한다', () => {
    expect(getCurriculumYear(student()).year).toBe(2023);
    expect(getCurriculumYear(student({ curriculumYear: 2025 })).year).toBe(2025);
  });

  it('편입 학번만으로 교육과정을 추정하지 않는다', () => {
    const result = getCurriculumYear(student({ admissionType: 'transfer' }));
    expect(result.year).toBeNull();
    expect(result.unknownReasons.length).toBeGreaterThan(0);
  });

  it('2026년 3학년 편입은 학적변동 없는 2024학년도 교육과정이다', () => {
    expect(getCurriculumYear(student({
      admissionType: 'transfer', transferAdmissionYear: 2026, transferEntryGrade: 3,
    })).year).toBe(2024);
  });

  it('전과 적용연도는 확인된 입력을 요구한다', () => {
    expect(getCurriculumYear(student({ admissionType: 'major-change' })).year).toBeNull();
    expect(getCurriculumYear(student({ admissionType: 'major-change', curriculumYear: 2024 })).year).toBe(2024);
  });

  it('다전공은 신입학연도가 아닌 선발연도 기준이다', () => {
    expect(getSecondaryCurriculumYear(student({ secondaryDepartmentId: 'business', secondarySelectionYear: 2025 })).year).toBe(2025);
    expect(getSecondaryCurriculumYear(student({ secondaryDepartmentId: 'business' })).unknownReasons.length).toBeGreaterThan(0);
  });

  it('지원하지 않는 연도는 가장 가까운 요람으로 대체하지 않는다', () => {
    expect(getCurriculumYear(student({ entryYear: 2019 })).year).toBeNull();
    expect(getCurriculumYear(student({ curriculumYear: 2027 })).year).toBeNull();
  });
});

describe('성적과 수료인정학점', () => {
  it('F는 평점0/학점미취득, P는 학점취득/평점제외, N은 둘다제외다', () => {
    expect(GRADES.find((grade) => grade.label === 'F')).toEqual({ label: 'F', points: 0, earned: false });
    expect(GRADES.find((grade) => grade.label === 'P')).toEqual({ label: 'P', points: null, earned: true });
    expect(GRADES.find((grade) => grade.label === 'N')).toEqual({ label: 'N', points: null, earned: false });
    expect(normalizeGrade(' np ')).toBe('N');
    expect(normalizeGrade('E')).toBeNull();
  });

  it('수료학점은 선형 추정 대신 공식 표를 사용한다', () => {
    expect(getCompletionCreditFloor(132, 7).credits).toBe(116);
    expect(getCompletionCreditFloor(135, 5).credits).toBe(86);
    expect(getCompletionCreditFloor(124, 6).credits).toBe(93);
  });

  it('의학계열 및 표에 없는 초과학기 기준은 확인필요로 남긴다', () => {
    expect(getCompletionCreditFloor(236, 7).credits).toBeNull();
    expect(getCompletionCreditFloor(132, 9).credits).toBeNull();
    expect(getCompletionCreditFloor(null, 6).credits).toBeNull();
  });
});

describe('글로컬 취득학점포기 정책', () => {
  it('등록7학기 1차는6학기, 2차는7학기 수료기준을 적용한다', () => {
    const first = calculateDeletionPolicy(student(), { totalGraduationCredits: 132 });
    expect(first).toMatchObject({ creditLimit: 6, completionCreditFloor: 99, referenceSemesters: 6, confirmed: true });
    const second = calculateDeletionPolicy(student({ deletionRound: 'second', baselineEarnedCredits: 122 }), { totalGraduationCredits: 132 });
    expect(second).toMatchObject({ creditLimit: 6, completionCreditFloor: 116, referenceSemesters: 7, confirmed: true });
  });

  it('2026년 공지의 경영학과8학기 130-124=6 사례와 일치한다', () => {
    expect(calculateDeletionPolicy(student({ registeredSemesters: 8, deletionRound: 'second', baselineEarnedCredits: 130 }), { totalGraduationCredits: 124 }).creditLimit).toBe(6);
  });

  it('과거 확정삭제를 또 차감하지 않고 미처리 신청량만 넘긴다', () => {
    const result = calculateDeletionPolicy(student({ priorPendingDeletionCredits: 3 }), { totalGraduationCredits: 132 });
    expect(result.creditLimit).toBe(6);
    expect(result.usedCredits).toBe(3);
  });

  it('최신 공지를 선택하면 별도 수강신청상한을 임의로 추가하지 않는다', () => {
    const result = calculateDeletionPolicy(student({ baselineEarnedCredits: 140 }), { totalGraduationCredits: 132, semesterCreditCap: 18 });
    expect(result.creditLimit).toBe(41);
    expect(result.notices[0]).toContain('요람');
  });

  it('상한 적용을 명시하면 확인된 값만 사용한다', () => {
    const result = calculateDeletionPolicy(student({ baselineEarnedCredits: 140 }), { totalGraduationCredits: 132, semesterCreditCap: 18, deletionCapRule: 'include-registration-cap' });
    expect(result.creditLimit).toBe(18);
    expect(calculateDeletionPolicy(student(), { totalGraduationCredits: 132, deletionCapRule: 'unresolved' }).confirmed).toBe(false);
  });

  it('수료학점 미달이어도 F/N 포기를 전역 차단하지 않는다', () => {
    const result = calculateDeletionPolicy(student({ baselineEarnedCredits: 90 }), { totalGraduationCredits: 132 });
    expect(result.creditLimit).toBe(0);
    expect(result.blockedReasons).toEqual([]);
    expect(result.allowedGrades).toEqual(['C+', 'C', 'D+', 'D', 'F', 'N']);
    expect(result.allowTransferCredits).toBe(false);
  });

  it('재학 여부 및 등록학기 자격을 구별한다', () => {
    expect(calculateDeletionPolicy(student({ enrollmentStatus: 'leave' }), { totalGraduationCredits: 132 }).blockedReasons?.length).toBeGreaterThan(0);
    expect(calculateDeletionPolicy(student({ registeredSemesters: 2 }), { totalGraduationCredits: 132 }).blockedReasons?.length).toBeGreaterThan(0);
    expect(calculateDeletionPolicy(student({ enrollmentStatus: 'unknown' }), { totalGraduationCredits: 132 }).confirmed).toBe(false);
  });

  it('미확인 학점·학기 정보는 0으로 간주해 정책을 확정하지 않는다', () => {
    for (const overrides of [
      { baselineEarnedCredits: null }, { registeredSemesters: null }, { priorPendingDeletionCredits: -1 },
      { baselineEarnedCredits: 100.5 }, { priorPendingDeletionCredits: 1.5 },
    ]) {
      const result = calculateDeletionPolicy(student(overrides), { totalGraduationCredits: 132 });
      expect(result.confirmed).toBe(false);
      expect(result.unknownReasons?.length).toBeGreaterThan(0);
    }
  });
});

describe('신청학기별 과목 삭제 자격', () => {
  function course(semester: string, overrides: Partial<Course> = {}): Course {
    return {
      id: semester, name: '예시 교과목', semester, categoryId: 'general', credits: 3,
      grade: 'C', deletionEligibility: 'eligible', ...overrides,
    };
  }

  it('1차는 당해·미래학기 제외, 2차는 당해학기 포함이다', () => {
    const courses = [course('2026-1'), course('2026-2'), course('2027-1')];
    expect(prepareCoursesForDeletion(courses, '2026-2', 'first').map((item) => item.deletionEligibility))
      .toEqual(['eligible', 'ineligible', 'ineligible']);
    expect(prepareCoursesForDeletion(courses, '2026-2', 'second').map((item) => item.deletionEligibility))
      .toEqual(['eligible', 'eligible', 'ineligible']);
    expect(courses.every((item) => item.deletionEligibility === 'eligible')).toBe(true);
  });

  it('계절학기 경계는 확인필요로 남기고 명백한 미래학기는 제외한다', () => {
    expect(prepareCoursesForDeletion([course('2025-겨울'), course('2026-여름'), course('2026-겨울')], '2026-2', 'first')
      .map((item) => item.deletionEligibility)).toEqual(['unknown', 'unknown', 'ineligible']);
  });

  it('기존의 미확인·불가 상태를 자동으로 가능으로 바꾸지 않는다', () => {
    const result = prepareCoursesForDeletion([
      course('2025-1', { deletionEligibility: 'unknown', deletionReason: '동일과목 확인 필요' }),
      course('2025-2', { deletionEligibility: 'ineligible', deletionReason: '편입 인정학점' }),
    ], '2026-2', 'second');
    expect(result.map((item) => item.deletionEligibility)).toEqual(['unknown', 'ineligible']);
    expect(result[0].deletionReason).toContain('동일과목 확인 필요');
  });

  it('잘못된 학기 문자열 및 계절 신청학기를 임의 해석하지 않는다', () => {
    expect(prepareCoursesForDeletion([course('2026학년도')], '2026-2', 'second')[0].deletionEligibility).toBe('unknown');
    expect(prepareCoursesForDeletion([course('2025-1')], '2026-여름', 'second')[0].deletionEligibility).toBe('unknown');
  });

  it('공식 공지의 NP 표기는 규정의 N으로 정규화한다', () => {
    const original = course('2025-1', { grade: 'NP' });
    expect(prepareCoursesForDeletion([original], '2026-2', 'first')[0].grade).toBe('N');
    expect(original.grade).toBe('NP');
  });
});
