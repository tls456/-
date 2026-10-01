import { describe, expect, it } from 'vitest';
import { buildProfile } from './buildProfile';
import { DEPARTMENT_CURRICULA } from '../data/catalog';
import type { StudentAcademic } from '../data/academic';

function student(overrides: Partial<StudentAcademic> = {}): StudentAcademic {
  return {
    entryYear: 2025, admissionType: 'freshman', registeredSemesters: 3,
    enrollmentStatus: 'enrolled', primaryDepartmentId: 'computer',
    secondaryDepartmentId: null, secondarySelectionYear: null,
    deletionRound: 'first', baselineEarnedCredits: 40,
    priorPendingDeletionCredits: 0, ...overrides,
  };
}

describe('공식 교육과정과 계산엔진 연결', () => {
  it('컴공 단일전공의 총학점·전필·전선과 교양을 연도별로 적용한다', () => {
    const result = buildProfile(student());
    expect(result.graduationRule.totalCredits).toBe(132);
    expect(result.graduationRule.areas.find((area) => area.id === 'primary-major-required')?.minCredits).toBe(3);
    expect(result.graduationRule.areas.find((area) => area.id === 'primary-major-elective')?.minCredits).toBe(63);
    expect(result.graduationRule.areas.find((area) => area.id === 'general-total')?.minCredits).toBe(31);
    expect(result.graduationRule.requiredCourses.find((course) => course.alternatives.includes('NDGE15060'))).toBeDefined();
    expect(result.graduationRule.unknownReasons).toEqual([]);
    expect(result.graduationRule.nonCreditRequirements!.length).toBeGreaterThan(0);
  });

  it('2020 컴공 공통6은 전필18에 포함되며 선택3중2를 각각 강제하지 않는다', () => {
    const result = buildProfile(student({ entryYear: 2020 }));
    const required = result.graduationRule.areas.find((area) => area.id === 'primary-major-required')!;
    expect(required.minCredits).toBe(18);
    expect(required.categoryIds).toContain('primary-common');
    const group = result.graduationRule.requiredCourses.find((course) => course.minimumCount === 2)!;
    expect(group.alternatives).toHaveLength(3);
    expect(result.graduationRule.requiredCourses.filter((course) => course.alternatives.length === 1 && group.alternatives.includes(course.alternatives[0]))).toHaveLength(0);
    expect(result.courseOptions.filter((course) => course.categoryId === 'primary-common')).toHaveLength(3);
  });

  it('심화교양은 총8학점과 최소4영역을 동시에 검사하도록 넘긴다', () => {
    const result = buildProfile(student());
    expect(result.graduationRule.areas.find((area) => area.id === 'general-advanced')?.minCredits).toBe(8);
    expect(result.graduationRule.categoryDiversity).toHaveLength(1);
    expect(result.graduationRule.categoryDiversity![0]).toMatchObject({ minCount: 4, minCreditsPerCategory: 1 });
    expect(result.graduationRule.categoryDiversity![0].categoryIds).toHaveLength(6);
    expect(buildProfile(student({ entryYear: 2020 })).graduationRule.categoryDiversity![0].categoryIds).toHaveLength(5);
  });

  it('다전공 선발연도와 경영45학점은 원전공의 입학연도와 구분한다', () => {
    const result = buildProfile(student({ entryYear: 2023, secondaryDepartmentId: '경영학과', secondarySelectionYear: 2025 }));
    expect(result.curriculumYear).toBe(2023);
    expect(result.secondaryYear).toBe(2025);
    expect(result.graduationRule.totalCredits).toBe(132);
    expect(result.graduationRule.areas.find((area) => area.id === 'primary-major-total')?.minCredits).toBe(40);
    expect(result.graduationRule.areas.find((area) => area.id === 'secondary-major-total')?.minCredits).toBe(45);
    expect(result.graduationRule.unknownReasons.some((reason) => reason.includes('전공필수'))).toBe(true);
  });

  it('컴공이 다전공이면 총졸업학점은 원전공 경영의124를 사용한다', () => {
    const result = buildProfile(student({ primaryDepartmentId: '경영학과', secondaryDepartmentId: 'computer', secondarySelectionYear: 2026 }));
    expect(result.graduationRule.totalCredits).toBe(124);
    expect(result.graduationRule.areas.find((area) => area.id === 'secondary-major-total')?.minCredits).toBe(40);
  });

  it('편입의 개인별 교양면제를 신입교양요건으로 대체하지 않는다', () => {
    const result = buildProfile(student({ admissionType: 'transfer', curriculumYear: 2024 }));
    expect(result.graduationRule.areas.some((area) => area.id === 'general-total')).toBe(false);
    expect(result.graduationRule.areas.some((area) => area.id === 'ge-science')).toBe(false);
    expect(result.graduationRule.unknownReasons.some((reason) => reason.includes('편입생의 교양'))).toBe(true);
  });

  it('확인된 적용연도가 없는 전과 및 지원범위 밖 전공은 확인필요다', () => {
    const noYear = buildProfile(student({ admissionType: 'major-change' }));
    expect(noYear.primary).toBeNull();
    expect(noYear.graduationRule.totalCredits).toBeNull();
    expect(noYear.graduationRule.unknownReasons.length).toBeGreaterThan(0);
    expect(buildProfile(student({ primaryDepartmentId: '경영학과' })).graduationRule.unknownReasons.some((reason) => reason.includes('컴퓨터공학과'))).toBe(true);
  });

  it.each([
    [2020, '바이오의약학전공', 39],
    [2020, '바이오생명공학전공', 39],
    [2021, '바이오의약학과', 38],
    [2024, '바이오의약학과', 38],
  ])('바이오 %i %s의 과학교양 두과목필수와 총학점%s을 보존한다', (year, department, total) => {
    const result = buildProfile(student({ entryYear: year as number, primaryDepartmentId: department as string, secondaryDepartmentId: 'computer', secondarySelectionYear: 2025 }));
    expect(result.graduationRule.areas.find((area) => area.id === 'ge-science')?.minCredits).toBe(6);
    expect(result.graduationRule.areas.find((area) => area.id === 'general-total')?.minCredits).toBe(total);
    for (const code of ['BKSA59512', 'BKSA58224']) {
      expect(result.graduationRule.requiredCourses.some((course) => course.alternatives.includes(code))).toBe(true);
      expect(result.courseOptions.find((course) => course.code === code)?.categoryId).toBe('ge-science');
    }
  });

  it('2025이후 바이오에는 이전연도의 과학교양예외를 이어붙이지 않는다', () => {
    const result = buildProfile(student({ primaryDepartmentId: '바이오의약학과', secondaryDepartmentId: 'computer', secondarySelectionYear: 2025 }));
    expect(result.graduationRule.areas.find((area) => area.id === 'ge-science')?.minCredits).toBe(2);
    expect(result.graduationRule.requiredCourses.some((course) => course.alternatives.includes('BKSA59512'))).toBe(false);
  });

  it('전체 학과-연도 조합은 제공된 영역만 참조하고 소스추적이 가능하다', () => {
    for (const department of DEPARTMENT_CURRICULA) {
      const result = buildProfile(student({ entryYear: department.year, primaryDepartmentId: department.departmentId,
        secondaryDepartmentId: department.departmentId === 'computer' ? null : 'computer', secondarySelectionYear: department.year }));
      const categoryIds = new Set(result.categories.map((category) => category.id));
      for (const area of result.graduationRule.areas) {
        expect(area.categoryIds.every((id) => categoryIds.has(id))).toBe(true);
      }
      for (const option of result.courseOptions) expect(categoryIds.has(option.categoryId)).toBe(true);
      expect(result.sources.some((source) => source.pdfPage != null)).toBe(true);
    }
  });
});
