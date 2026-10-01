import { describe, expect, it } from 'vitest';
import { ACADEMIC_YEARS, GRADES, type StudentAcademic } from '../data/academic';
import { DEPARTMENT_CURRICULA } from '../data/catalog';
import { createDemo } from '../demo';
import { defaultAcademic, emptyState, type AppState } from '../state';
import { simulate } from './simulator';
import { getPersonalContextKey } from './personal';
import type { Course, ScenarioResult } from './types';

function course(id: string, overrides: Partial<Course> = {}): Course {
  return { id, name: `가상 검증 ${id}`, semester: '2025-2', categoryId: 'primary-elective', credits: 3, grade: 'C', deletionEligibility: 'eligible', ...overrides };
}

function state(academic: Partial<StudentAcademic> = {}): AppState {
  return emptyState({ ...defaultAcademic(2023), registeredSemesters: 7, enrollmentStatus: 'enrolled', baselineEarnedCredits: 110, ...academic });
}

function valid(input: AppState): Extract<ScenarioResult, { valid: true }> {
  const result = simulate(input).result;
  if (!result.valid) throw new Error(result.issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
  return result;
}

describe('교육과정·개인정책·계산 엔진 통합', () => {
  it('개인 확인 필수과목·영역 기준은 현재 학적에만 적용하고 학적 변경 시 모두 미적용한다', () => {
    const input = state();
    input.personalRequirements = {
      contextKey: getPersonalContextKey(input.academic),
      sourceNote: '가상 통합검증용 학과 확인 기록. 공식 학교 자료가 아닙니다.',
      checkedAt: '2026-10-02',
      requiredCourses: [{ id: 'personal-course-capstone', label: '개인 확인 필수 실습', alternatives: ['PERSONAL-CAPSTONE'] }],
      areas: [{ id: 'primary-major-total', label: '개인 승인 전공 최소', minCredits: 3, categoryIds: ['primary-required', 'primary-elective'] }],
      exemptRequirementIds: [], confirmedUnknownReasons: [], confirmedNonCreditRequirements: [],
    };
    const savedPersonal = structuredClone(input.personalRequirements);
    expect(valid(input).after.currentGraduation.missingRequiredCourses.some(course => course.id === 'personal-course-capstone')).toBe(true);
    input.courses = [course('personal-pass', { courseCode: 'PERSONAL-CAPSTONE', grade: 'P' })];
    const applied = valid(input);
    expect(applied.after.currentGraduation.missingRequiredCourses.some(course => course.id === 'personal-course-capstone')).toBe(false);
    expect(applied.after.currentGraduation.areas.find(area => area.id === 'primary-major-total')).toMatchObject({ required: 3, earned: 3, missing: 0 });
    input.academic.curriculumYear = 2024;
    const changed = simulate(input);
    expect(changed.result.valid).toBe(true);
    expect(changed.profile.graduationRule.requiredCourses.some(course => course.id === 'personal-course-capstone')).toBe(false);
    expect(changed.profile.graduationRule.areas.find(area => area.id === 'primary-major-total')?.minCredits).toBe(66);
    expect(changed.profile.graduationRule.unknownReasons.some(reason => reason.includes('개인 확인내용 미적용'))).toBe(true);
    expect(input.personalRequirements).toEqual(savedPersonal);
  });

  it.each(ACADEMIC_YEARS)('%i학번 신규 입력은 삭제 조건 미확인 상태에서도 기본 계산을 제공한다', year => {
    const input = emptyState(defaultAcademic(year));
    input.courses = [course('current', { grade: 'B+' })];
    const computed = simulate(input);
    const result = valid(input);
    expect(computed.profile.curriculumYear).toBe(year);
    expect(computed.profile.graduationRule.totalCredits).toBe(132);
    expect(computed.policy.confirmed).toBe(false);
    expect(result.before.totals).toMatchObject({ C: 3, W: 3, S: 10.5, gpa: 3.5 });
    expect(result.deletion.additionalMaxCredits).toBeNull();
    expect(result.before.currentGraduation.total?.missing).toBe(129);
    expect(result.before.currentGraduation.status).toBe('unverified');
  });

  it('실제 환산표에서 P/N/F 및 NP 별칭을 정확하게 연결한다', () => {
    const input = state();
    input.courses = GRADES.map(grade => course(`grade-${grade.label}`, { grade: grade.label, credits: 1 }));
    input.courses.push(course('alias-np', { grade: 'NP', credits: 2 }));
    const result = valid(input);
    expect(result.before.totals).toMatchObject({ C: 9, W: 9, S: 22 });
    expect(result.before.totals.gpa).toBeCloseTo(22 / 9);
    const normalized = simulate(input).input.courses.find(item => item.id === 'alias-np');
    expect(normalized?.grade).toBe('N');
    expect(input.courses.at(-1)?.grade).toBe('NP');
  });

  it('가상 시연 데이터가 계산 가능하며 반복 계산이 입력·규칙 자료를 바꾸지 않는다', () => {
    const input = createDemo();
    const before = JSON.stringify(input);
    const gradeTable = JSON.stringify(GRADES);
    const catalog = JSON.stringify(DEPARTMENT_CURRICULA);
    const result = valid(input);
    expect(input.demo).toBe(true);
    expect(result.before.totals.C).toBeGreaterThan(0);
    expect(result.before.totals.W).toBeGreaterThan(0);
    expect(result.after.goal.futureGradedCredits).toBe(24);
    expect(result.after.goal.futureCredits).toBe(26);
    expect(result.after.goal.requiredAverage).not.toBeNull();
    expect(valid(input)).toEqual(result);
    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.stringify(GRADES)).toBe(gradeTable);
    expect(JSON.stringify(DEPARTMENT_CURRICULA)).toBe(catalog);
  });

  it('가상 F 삭제는 한도를 쓰지 않으며 해제 시 정확하게 복원된다', () => {
    const input = createDemo();
    const original = valid(input);
    const selected = valid({ ...input, selectedCourseIds: ['demo-failed'] });
    expect(selected.deletion).toMatchObject({ applied: true, selectedChargeCredits: 0, selectedCourseCredits: 3 });
    expect(selected.after.totals.C).toBe(original.after.totals.C);
    expect(selected.after.totals.W).toBe(original.after.totals.W - 3);
    expect(selected.after.totals.S).toBe(original.after.totals.S);
    expect(selected.after.totals.gpa!).toBeGreaterThan(original.after.totals.gpa!);
    expect(selected.deletion.remainingCreditLimit).toBe(original.deletion.remainingCreditLimit);
    expect(valid({ ...input, selectedCourseIds: [] })).toEqual(original);
  });

  it('총취득 110, 직전 6학기 수료 99에서 후보 3학점 네 개의 실제 최대는 9다', () => {
    const input = state();
    input.courses = Array.from({ length: 4 }, (_, index) => course(`low-${index}`));
    const computed = simulate(input);
    expect(computed.policy).toMatchObject({ confirmed: true, completionCreditFloor: 99, creditLimit: 11, usedCredits: 0 });
    expect(valid(input).deletion.additionalMaxCredits).toBe(9);
    const selected = valid({ ...input, selectedCourseIds: input.courses.slice(0, 3).map(item => item.id) });
    expect(selected.deletion).toMatchObject({ applied: true, selectedChargeCredits: 9, remainingCreditLimit: 2, additionalMaxCredits: 0 });
    const tooMany = valid({ ...input, selectedCourseIds: input.courses.map(item => item.id) });
    expect(tooMany.deletion.applied).toBe(false);
    expect(tooMany.after.totals).toEqual(tooMany.before.totals);
  });

  it('사용자 확정 기준에 따라 수강신청 상한을 임의로 적용하지 않는다', () => {
    const input = state({ baselineEarnedCredits: 120 });
    input.courses = Array.from({ length: 7 }, (_, index) => course(`low-${index}`));
    const computed = simulate(input);
    expect(computed.policy.creditLimit).toBe(21);
    expect(valid(input).deletion.additionalMaxCredits).toBe(21);
    input.academic.priorPendingDeletionCredits = 3;
    expect(valid(input).deletion.remainingCreditLimit).toBe(18);
    expect(valid(input).deletion.additionalMaxCredits).toBe(18);
  });

  it('공식 삭제 허용 등급 밖의 과목은 사용자 자격 선택만으로 허용하지 않는다', () => {
    const input = state();
    input.courses = [course('high', { grade: 'B+' })];
    input.selectedCourseIds = ['high'];
    expect(valid(input).deletion.eligibility[0].status).toBe('ineligible');
    expect(valid(input).deletion.applied).toBe(false);
  });

  it('재학 상태·등록 학기가 불가인 경우 성적 계산은 유지하고 삭제만 차단한다', () => {
    const input = state({ registeredSemesters: 2, enrollmentStatus: 'leave' });
    input.courses = [course('low')];
    input.selectedCourseIds = ['low'];
    const result = valid(input);
    expect(result.before.totals.gpa).toBe(2);
    expect(result.deletion.applied).toBe(false);
    expect(result.deletion.reasons.join(' ')).toContain('휴학생');
    expect(result.deletion.reasons.join(' ')).toContain('3학기');
  });

  it('차수 변경은 당해학기 삭제 자격과 수료 기준을 함께 갱신한다', () => {
    const input = state({ baselineEarnedCredits: 120 });
    input.courses = [course('current', { semester: input.applicationTerm })];
    input.selectedCourseIds = ['current'];
    expect(valid(input).deletion.applied).toBe(false);
    input.academic.deletionRound = 'second';
    const computed = simulate(input);
    expect(computed.policy).toMatchObject({ referenceSemesters: 7, completionCreditFloor: 116, creditLimit: 4 });
    expect(valid(input).deletion).toMatchObject({ applied: true, remainingCreditLimit: 1 });
  });

  it('편입생 교육과정과 인정학점은 GPA·삭제·개인 졸업요건을 구분한다', () => {
    const input = state({ admissionType: 'transfer', transferAdmissionYear: 2025, transferEntryGrade: 3 });
    input.courses = [course('transfer', { credits: 60, grade: 'A', transferCredit: true }), course('local')];
    input.selectedCourseIds = ['transfer'];
    const computed = simulate(input);
    const result = valid(input);
    expect(computed.profile.curriculumYear).toBe(2023);
    expect(result.before.totals).toMatchObject({ C: 63, W: 3, S: 6, gpa: 2 });
    expect(result.deletion.applied).toBe(false);
    expect(result.before.currentGraduation.unknownReasons.some(reason => reason.includes('개인별'))).toBe(true);
  });

  it('다전공은 원전공 입학연도와 별개로 선발연도 기준을 적용한다', () => {
    const input = state({ entryYear: 2020, secondaryDepartmentId: '경영학과', secondarySelectionYear: 2023 });
    input.courses = [course('computer'), course('business', { categoryId: 'secondary-elective' })];
    const computed = simulate(input);
    const result = valid(input);
    expect(computed.profile.curriculumYear).toBe(2020);
    expect(computed.profile.secondaryYear).toBe(2023);
    expect(result.after.currentGraduation.areas.find(area => area.id === 'primary-major-total')).toMatchObject({ required: 40, earned: 3 });
    expect(result.after.currentGraduation.areas.find(area => area.id === 'secondary-major-total')).toMatchObject({ required: 45, earned: 3 });
    expect(result.after.currentGraduation.status).toBe('unverified');
  });

  it('적용 연도가 미확정인 전과생도 일반 성적은 계산하되 졸업을 확정하지 않는다', () => {
    const input = state({ admissionType: 'major-change' });
    input.courses = [course('local', { grade: 'A' })];
    const result = valid(input);
    expect(result.before.totals.gpa).toBe(4);
    expect(result.before.currentGraduation.total).toBeNull();
    expect(result.before.currentGraduation.status).toBe('unverified');
    expect(simulate(input).profile.curriculumYear).toBeNull();
  });

  it('교육과정 변경으로 사라진 구분은 원본을 재분류하지 않고 오류 위치를 안내한다', () => {
    const input = emptyState(defaultAcademic(2021));
    input.courses = [course('old-ge', { categoryId: 'ge-communication' })];
    expect(valid(input).before.totals.C).toBe(3);
    input.academic.curriculumYear = 2026;
    const result = simulate(input).result;
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues[0]).toMatchObject({ path: 'courses.0.categoryId' });
    expect(input.courses[0].categoryId).toBe('ge-communication');
  });

  it('계획 과목의 잘못된 영역과 산술 범위를 초과한 입력은 계산을 차단한다', () => {
    const input = createDemo();
    input.semesters[0].courses[0].categoryId = 'not-current-curriculum';
    let result = simulate(input).result;
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues[0].path).toBe('semesters.0.courses.0.categoryId');
    input.semesters[0].courses[0].categoryId = 'primary-elective';
    input.courses[0].credits = Number.MAX_SAFE_INTEGER;
    result = simulate(input).result;
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.some(issue => issue.message.includes('입력 범위'))).toBe(true);
  });
});
