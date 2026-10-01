import { describe, expect, it } from 'vitest';
import { calculateScenario, formatGpa, formatRequiredAverage, validateScenario } from './engine';
import type { Course, ScenarioInput, ScenarioResult, Semester } from './types';

// Every value in this fixture is a fictional test rule, not a university policy.
const grades = [
  { label: 'A+', points: 4.5, earned: true },
  { label: 'A', points: 4, earned: true },
  { label: 'B+', points: 3.5, earned: true },
  { label: 'B', points: 3, earned: true },
  { label: 'C', points: 2, earned: true },
  { label: 'D', points: 1, earned: true },
  { label: 'F', points: 0, earned: false },
  { label: 'P', points: null, earned: true },
  { label: 'NP', points: null, earned: false },
];

function course(id: string, credits = 3, grade = 'B', overrides: Partial<Course> = {}): Course {
  return { id, courseCode: id, name: `과목 ${id}`, semester: '2025-1', categoryId: 'major', credits, grade, deletionEligibility: 'eligible', ...overrides };
}

function semester(id: string, credits: number, fixedTarget: number | null = null): Semester {
  return { id, label: id, fixedTarget, courses: [{ id: `planned-${id}`, name: '계획 과목', credits, categoryId: 'major', graded: true }] };
}

function scenario(overrides: Partial<ScenarioInput> = {}): ScenarioInput {
  return {
    grades,
    courses: [],
    semesters: [],
    graduationRule: { totalCredits: 120, areas: [], requiredCourses: [], unknownReasons: [] },
    deletionPolicy: { creditLimit: 6, usedCredits: 0, confirmed: true },
    targetGpa: 3.5,
    selectedCourseIds: [],
    ...overrides,
  };
}

function result(input: ScenarioInput): Extract<ScenarioResult, { valid: true }> {
  const value = calculateScenario(input);
  if (!value.valid) throw new Error(value.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  return value;
}

const exampleCourses = () => [course('low', 3, 'D'), course('b', 51, 'B'), course('a', 6, 'A')];

describe('기획서 T01~T11', () => {
  it('T01: 평균은 과목 학점 수로 가중한다', () => {
    expect(result(scenario({ courses: [course('a', 3, 'A'), course('b', 2, 'C')] })).before.totals.gpa).toBe(3.2);
  });

  it('T02: P 이수와 F 평점 산정 기여를 분리한다', () => {
    expect(result(scenario({ courses: [course('p', 3, 'P'), course('f', 3, 'F')] })).before.totals).toMatchObject({ C: 3, W: 3, S: 0, gpa: 0 });
  });

  it('T03: 현재 60학점 3.0, 미래 60학점에서 목표 3.5에는 4.0이 필요하다', () => {
    const value = result(scenario({ courses: exampleCourses(), semesters: [semester('next', 60)] }));
    expect(value.before.totals).toMatchObject({ C: 60, W: 60, S: 180 });
    expect(value.before.goal.requiredAverage).toBe(4);
  });

  it('T04: 삭제 후 보충 학점 수와 기존 계획을 서로 다르게 계산한다', () => {
    const input = scenario({ courses: exampleCourses(), semesters: [semester('next', 63)], selectedCourseIds: ['low'] });
    const supplemented = result(input);
    expect(supplemented.after.totals).toMatchObject({ C: 57, W: 57, S: 177 });
    expect(supplemented.after.goal.requiredAverage).toBeCloseTo(3.857142857142857);
    expect(supplemented.after.goal.requiredAverageDisplay).toBe('3.858');
    expect(supplemented.after.plannedGraduation.total?.missing).toBe(0);
    input.semesters = [semester('next', 60)];
    const unchangedPlan = result(input);
    expect(unchangedPlan.after.goal.requiredAverage).toBe(3.875);
    expect(unchangedPlan.after.plannedGraduation.total?.missing).toBe(3);
    expect(input.semesters[0].courses[0].credits).toBe(60);
  });

  it.each(['limit', 'eligibility'])('T05: %s 위반 선택은 부분 적용 없이 차단한다', (mode) => {
    const input = scenario({ courses: [course('a'), course('b', 3, 'D', { deletionEligibility: mode === 'eligibility' ? 'ineligible' : 'eligible' })], selectedCourseIds: ['a', 'b'] });
    if (mode === 'limit') input.deletionPolicy.creditLimit = 5;
    const value = result(input);
    expect(value.deletion.applied).toBe(false);
    expect(value.deletion.reasons.length).toBeGreaterThan(0);
    expect(value.after).toEqual(value.before);
  });

  it('T06: 한도 5, 후보 3+3의 실제 최대는 3이다', () => {
    const input = scenario({ courses: [course('a'), course('b')] });
    input.deletionPolicy.creditLimit = 5;
    expect(result(input).deletion.additionalMaxCredits).toBe(3);
  });

  it('T07: 총학점 충족만으로 누락된 필수과목을 통과시키지 않는다', () => {
    const input = scenario({ courses: [course('a', 120)] });
    input.graduationRule.requiredCourses = [{ id: 'thesis', label: '졸업프로젝트', alternatives: ['CAPSTONE'] }];
    const value = result(input).before.currentGraduation;
    expect(value.total?.missing).toBe(0);
    expect(value.missingRequiredCourses[0].label).toBe('졸업프로젝트');
    expect(value.status).toBe('insufficient');
  });

  it('T08: 필요 평균 4.6은 4.5로 잘라내지 않고 달성 불가를 표시한다', () => {
    const value = result(scenario({ courses: [course('a', 10, 'C')], semesters: [semester('next', 10)], targetGpa: 3.3 }));
    expect(value.after.goal.requiredAverage).toBe(4.6);
    expect(value.after.goal.requiredAverageDisplay).toBe('4.600');
    expect(value.after.goal.status).toBe('impossible');
    expect(value.after.goal.projectedGpa).toBeNull();
  });

  it('T09: N=0은 미래 필요 평균을 산정하지 않고 현재값으로 판단한다', () => {
    const value = result(scenario({ courses: [course('a', 3, 'A')] })).after.goal;
    expect(value.requiredAverage).toBeNull();
    expect(value.status).toBe('met');
    expect(value.projectedGpa).toBe(4);
  });

  it('T09: W=0, N>0이면 필요 평균은 목표와 같다', () => {
    const value = result(scenario({ courses: [course('p', 3, 'P')], semesters: [semester('next', 6)] }));
    expect(value.before.totals.gpa).toBeNull();
    expect(value.after.goal.requiredAverage).toBe(3.5);
  });

  it('T10: 앞 학기 30학점을 3.5로 고정하면 다음 30학점에는 4.5가 필요하다', () => {
    const value = result(scenario({ courses: exampleCourses(), semesters: [semester('first', 30, 3.5), semester('second', 30)] }));
    expect(value.after.goal.requiredAverage).toBe(4.5);
    expect(value.after.goal.semesters.map((entry) => entry.target)).toEqual([3.5, 4.5]);
    expect(value.after.goal.minGpa).toBe(285 / 120);
    expect(value.after.goal.maxGpa).toBe(3.5);
  });

  it('T11: 삭제 해제와 성적 수정은 원본에서 다시 계산한다', () => {
    const input = scenario({ courses: exampleCourses(), semesters: [semester('next', 60)] });
    const original = structuredClone(input);
    const initial = result(input);
    input.selectedCourseIds = ['low'];
    expect(result(input).after.totals.W).toBe(57);
    input.selectedCourseIds = [];
    expect(result(input)).toEqual(initial);
    expect(input).toEqual(original);
    input.courses[0].grade = 'A';
    expect(result(input).after.totals.S).toBe(189);
  });
});

describe('자격·한도와 조합', () => {
  it('F/NP는 소진 0이지만 F의 평점 분모를 제거한다', () => {
    const input = scenario({ courses: [course('f', 3, 'F'), course('np', 2, 'NP'), course('a', 3, 'A')], selectedCourseIds: ['f', 'np'] });
    input.deletionPolicy.creditLimit = 0;
    const value = result(input);
    expect(value.deletion).toMatchObject({ applied: true, selectedCourseCredits: 5, selectedChargeCredits: 0, remainingCreditLimit: 0 });
    expect(value.before.totals.gpa).toBe(2);
    expect(value.after.totals.gpa).toBe(4);
  });

  it('0학점 소진 후보는 추가 가능 학점 0이어도 선택 가능한 과목이다', () => {
    const input = scenario({ courses: [course('f', 3, 'F'), course('a', 3)] });
    input.deletionPolicy.creditLimit = 0;
    expect(result(input).deletion).toMatchObject({ additionalMaxCredits: 0, additionalMaxCourseIds: ['f'], additionalSelectableCourseCount: 1, candidateState: 'available' });
  });

  it('개수 제한과 기존 사용량까지 함께 적용한다', () => {
    const input = scenario({ courses: [course('a', 4), course('b', 3), course('c', 2), course('f', 3, 'F')] });
    input.deletionPolicy = { confirmed: true, creditLimit: 9, usedCredits: 2, maxCourses: 2, usedCourses: 1 };
    expect(result(input).deletion.additionalMaxCredits).toBe(4);
    input.selectedCourseIds = ['b', 'c'];
    expect(result(input).deletion.applied).toBe(false);
  });

  it('탐욕 선택이 실패하는 4+3+3, 한도6 조합의 최대는 6이다', () => {
    const input = scenario({ courses: [course('a', 4), course('b', 3), course('c', 3)] });
    expect(result(input).deletion.additionalMaxCredits).toBe(6);
  });

  it('현재 수료학점 하한은 미래 계획을 더하지 않고 검사한다', () => {
    const input = scenario({ courses: [course('a', 4), course('b', 3)], semesters: [semester('future', 120)], selectedCourseIds: ['a'] });
    input.deletionPolicy.earnedCreditFloor = 4;
    expect(result(input).deletion.applied).toBe(false);
    input.selectedCourseIds = [];
    expect(result(input).deletion.additionalMaxCredits).toBe(3);
  });

  it('미확인 후보는 확정 최대에서 제외하고 선택 시 명시적 가정을 요구한다', () => {
    const input = scenario({ courses: [course('known'), course('unknown', 3, 'D', { deletionEligibility: 'unknown' })] });
    expect(result(input).deletion.additionalMaxCredits).toBe(3);
    input.selectedCourseIds = ['unknown'];
    expect(result(input).deletion.applied).toBe(false);
    input.assumeUnknownDeletionEligibility = true;
    const value = result(input);
    expect(value.deletion).toMatchObject({ applied: true, assumed: true, additionalMaxCredits: null, candidateState: 'unverified' });
    expect(value.warnings.some((warning) => warning.includes('자격 확인 전 가정'))).toBe(true);
  });

  it('가정 허용도 확정 불가 과목과 규정 한도를 무시하지 않는다', () => {
    const input = scenario({ courses: [course('a', 7, 'D', { deletionEligibility: 'unknown' })], selectedCourseIds: ['a'], assumeUnknownDeletionEligibility: true });
    expect(result(input).deletion.applied).toBe(false);
    input.courses[0] = course('a', 3, 'D', { deletionEligibility: 'ineligible' });
    expect(result(input).deletion.applied).toBe(false);
  });

  it('편입 인정학점은 졸업에는 인정하되 본교 GPA에서 제외한다', () => {
    const input = scenario({ courses: [course('transfer', 60, 'A', { transferCredit: true }), course('local', 3, 'C')], selectedCourseIds: ['transfer'] });
    input.deletionPolicy.allowTransferCredits = false;
    const value = result(input);
    expect(value.before.totals).toMatchObject({ C: 63, W: 3, S: 6, gpa: 2 });
    expect(value.deletion.eligibility[0].status).toBe('ineligible');
    expect(value.deletion.applied).toBe(false);
  });

  it('미확정 규칙의 null은 무제한이라고 단정하지 않는다', () => {
    const input = scenario({ courses: [course('a')] });
    input.deletionPolicy = { confirmed: false, creditLimit: null, usedCredits: 0, unknownReasons: ['규칙 자료 없음'] };
    expect(result(input).deletion).toMatchObject({ additionalMaxCredits: null, candidateState: 'unverified' });
    input.deletionPolicy.confirmed = true;
    input.deletionPolicy.unknownReasons = [];
    expect(result(input).deletion.additionalMaxCredits).toBe(3);
  });

  it('후보 없음과 후보는 있지만 가능한 조합 없음을 구분한다', () => {
    expect(result(scenario()).deletion.candidateState).toBe('no-candidates');
    const input = scenario({ courses: [course('a', 7)] });
    expect(result(input).deletion.candidateState).toBe('no-combination');
  });
});

describe('영역·필수 과목·규칙 확인', () => {
  it('전공별 기준과 복수 영역 합계를 독립적으로 검사한다', () => {
    const input = scenario({ courses: [course('cs', 6, 'A', { categoryId: 'cs-required' }), course('second', 3, 'B', { categoryId: 'design' })] });
    input.graduationRule = { totalCredits: 9, areas: [{ id: 'cs', label: '컴공', minCredits: 9, categoryIds: ['cs-required', 'cs-elective', 'cs-required'] }, { id: 'second', label: '복수전공', minCredits: 6, categoryIds: ['design'] }], requiredCourses: [], unknownReasons: [] };
    expect(result(input).after.currentGraduation.areas.map((area) => area.missing)).toEqual([3, 3]);
  });

  it('3과목 중 2개 필수에서 같은 과목 코드 중복이수를 두 번 세지 않는다', () => {
    const input = scenario({ courses: [course('first', 3, 'A', { courseCode: 'MATH' }), course('second', 3, 'B', { courseCode: 'MATH' })] });
    input.graduationRule.requiredCourses = [{ id: 'basic', label: '학부공통 선택필수', alternatives: ['MATH', 'PHYSICS', 'PROGRAMMING'], minimumCount: 2 }];
    expect(result(input).after.currentGraduation.missingRequiredCourses[0]).toMatchObject({ completedCount: 1, missingCount: 1 });
    input.semesters = [semester('next', 3)];
    input.semesters[0].courses[0].courseCode = 'PROGRAMMING';
    expect(result(input).after.plannedGraduation.missingRequiredCourses).toEqual([]);
  });

  it('교양 영역 다양성은 총학점과 별도로 최소 영역 수를 검사한다', () => {
    const input = scenario({ courses: [course('a', 8, 'P', { categoryId: 'humanity' })] });
    input.graduationRule = { totalCredits: 8, areas: [], requiredCourses: [], unknownReasons: [], categoryDiversity: [{ id: 'breadth', label: '심화교양 4영역', categoryIds: ['humanity', 'science', 'art', 'social', 'language', 'global'], minCount: 4 }] };
    const value = result(input).after.currentGraduation;
    expect(value.categoryDiversity[0]).toMatchObject({ requiredCount: 4, completedCount: 1, missingCount: 3 });
    expect(value.creditRequirementsSatisfied).toBe(false);
  });

  it('규칙 미확정과 학점 외 요건은 확인필요로 남기고 알려진 부족분은 계산한다', () => {
    const input = scenario({ courses: [course('a', 3)] });
    input.graduationRule.unknownReasons = ['전과 학생 개별 인정 기준 확인'];
    input.graduationRule.nonCreditRequirements = ['졸업인증 확인'];
    const value = result(input).after.currentGraduation;
    expect(value.status).toBe('unverified');
    expect(value.total?.missing).toBe(117);
    expect(value.nonCreditRequirements).toEqual(['졸업인증 확인']);
  });

  it('F 과목은 필수 이수로 인정하지 않고 P 계획은 조건부 졸업학점에만 반영한다', () => {
    const input = scenario({ courses: [course('must', 3, 'F')] });
    input.graduationRule.requiredCourses = [{ id: 'required', label: '필수', alternatives: ['must'] }];
    input.semesters = [semester('pass-only', 3)];
    input.semesters[0].courses[0].graded = false;
    input.semesters[0].courses[0].courseCode = 'must';
    const value = result(input);
    expect(value.before.currentGraduation.missingRequiredCourses).toHaveLength(1);
    expect(value.after.plannedGraduation.missingRequiredCourses).toHaveLength(0);
    expect(value.after.goal.futureGradedCredits).toBe(0);
    expect(value.after.goal.semesters[0].target).toBeNull();
  });
});

describe('수치 경계와 입력 검증', () => {
  it('전 학기 고정 시 목표 역산 대신 예상평점과 달성 여부를 계산한다', () => {
    const input = scenario({ courses: [course('a', 30, 'B')], semesters: [semester('fixed', 30, 4)] });
    const value = result(input).after.goal;
    expect(value).toMatchObject({ requiredAverage: null, projectedGpa: 3.5, status: 'met', minGpa: 3.5, maxGpa: 3.5 });
    input.semesters[0].fixedTarget = 3.999;
    expect(result(input).after.goal.status).toBe('not-met');
  });

  it('W=N=0에서 GPA를 0으로 오인시키지 않는다', () => {
    const value = result(scenario());
    expect(value.after.totals.gpaDisplay).toBe('산정 대상 없음');
    expect(value.after.goal).toMatchObject({ status: 'no-gpa', minGpa: null, maxGpa: null, requiredAverage: null });
  });

  it('최저 필요값 이하는 성적목표 확보로 표시하고 졸업 부족분을 보존한다', () => {
    const value = result(scenario({ courses: [course('a', 60, 'A+')], semesters: [semester('future', 3)], targetGpa: 3 }));
    expect(value.after.goal.status).toBe('already-secured');
    expect(value.after.goal.requiredAverage).toBeLessThan(0);
    expect(value.after.plannedGraduation.total?.missing).toBe(57);
  });

  it('정수 비율로 셋째 자리 올림과 둘째 자리 반올림을 표시한다', () => {
    expect(formatGpa({ numerator: 2675, denominator: 1000 })).toBe('2.68');
    expect(formatRequiredAverage({ numerator: 27000, denominator: 7000 })).toBe('3.858');
    expect(formatRequiredAverage({ numerator: 3875, denominator: 1000 })).toBe('3.875');
    expect(formatRequiredAverage({ numerator: -38751, denominator: 10000 })).toBe('-3.875');
    const input = scenario({ courses: [course('one', 1, 'B')], semesters: [semester('three', 3)], targetGpa: 3.001 });
    expect(result(input).after.goal.requiredAverageDisplay).toBe('3.002');
  });

  it('표시상 같은 4.50이어도 내부 필요값이 최고값을 넘으면 불가다', () => {
    const input = scenario({ courses: [course('near', 3, 'near')], semesters: [semester('one', 1)], targetGpa: 4.5 });
    input.grades = [...grades, { label: 'near', points: 4.499, earned: true }];
    const value = result(input).after.goal;
    expect(formatGpa(value.requiredAverage)).toBe('4.50');
    expect(value.requiredAverageDisplay).toBe('4.503');
    expect(value.status).toBe('impossible');
  });

  it.each([
    ['0 학점', (input: ScenarioInput) => { input.courses[0].credits = 0; }],
    ['소수 학점', (input: ScenarioInput) => { input.courses[0].credits = 2.5; }],
    ['이름 누락', (input: ScenarioInput) => { input.courses[0].name = ''; }],
    ['학기 누락', (input: ScenarioInput) => { input.courses[0].semester = ''; }],
    ['없는 등급', (input: ScenarioInput) => { input.courses[0].grade = 'unknown'; }],
    ['중복 ID', (input: ScenarioInput) => { input.courses.push(course('a')); }],
    ['중복 삭제 ID', (input: ScenarioInput) => { input.selectedCourseIds = ['a', 'a']; }],
    ['삭제 ID 없음', (input: ScenarioInput) => { input.selectedCourseIds = ['missing']; }],
    ['평점 정밀도 초과', (input: ScenarioInput) => { input.targetGpa = 3.0001; }],
    ['고정 목표 초과', (input: ScenarioInput) => { input.semesters = [semester('invalid', 3, 4.6)]; }],
  ])('%s 입력은 계산을 차단한다', (_, change) => {
    const input = scenario({ courses: [course('a')] });
    change(input);
    expect(calculateScenario(input).valid).toBe(false);
    expect(validateScenario(input).length).toBeGreaterThan(0);
  });

  it('같은 과목명이어도 ID가 다른 수강기록은 허용한다', () => {
    const input = scenario({ courses: [course('a', 3, 'B', { name: '알고리즘' }), course('b', 3, 'A', { name: '알고리즘' })] });
    expect(validateScenario(input)).toEqual([]);
  });

  it('200과목, 개수와 학점 제한을 모두 적용하여 1초 이내 계산한다', () => {
    const input = scenario({ courses: Array.from({ length: 200 }, (_, i) => course(`course-${i}`, i % 4 + 1, i % 3 ? 'B' : 'F')), semesters: [semester('future', 30)] });
    input.deletionPolicy = { confirmed: true, creditLimit: 39, usedCredits: 3, maxCourses: 20 };
    const start = performance.now();
    const value = result(input);
    const duration = performance.now() - start;
    expect(value.deletion.additionalMaxCredits).toBe(36);
    expect(duration).toBeLessThan(1000);
  });
});
