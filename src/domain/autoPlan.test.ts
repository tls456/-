import { describe, expect, it } from 'vitest';
import { createAutoPlan, UNCLASSIFIED_PLAN_CATEGORY } from './autoPlan';
import { emptyState, defaultAcademic } from '../state';
import { simulate } from './simulator';

describe('남은 졸업학점의 가상 정규학기 계획', () => {
  it('74학점을 2026-2부터 18·18·18·18·2로 배분한다', () => {
    const plan = createAutoPlan(74, '2026-2');
    expect(plan.map(s => s.label)).toEqual(['2026-2', '2027-1', '2027-2', '2028-1', '2028-2']);
    expect(plan.map(s => s.courses.reduce((sum, c) => sum + c.credits, 0))).toEqual([18, 18, 18, 18, 2]);
    expect(plan.flatMap(s => s.courses).every(c => c.graded && c.categoryId === UNCLASSIFIED_PLAN_CATEGORY && !c.courseCode)).toBe(true);
    const ids = plan.flatMap(s => [s.id, ...s.courses.map(c => c.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('0학점이면 빈 계획이며 마지막 학기는 정확한 잔여학점이다', () => {
    expect(createAutoPlan(0, '2026-1')).toEqual([]);
    expect(createAutoPlan(19, '2026-1').map(s => s.courses.reduce((sum, c) => sum + c.credits, 0))).toEqual([18, 1]);
  });
  it('계절학기·소수·음수·지원 범위 초과를 거절한다', () => {
    for (const credits of [-1, 1.5, 541, NaN]) expect(() => createAutoPlan(credits, '2026-2')).toThrow();
    expect(() => createAutoPlan(74, '2026-여름')).toThrow();
  });
  it('가상 계획은 총학점과 평점에만 반영하고 영역·필수과목을 충족하지 않는다', () => {
    const state = { ...emptyState(defaultAcademic(2025)), targetGpa: 3.5, semesters: createAutoPlan(132, '2026-2') };
    const result = simulate(state).result;
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.after.goal.requiredAverage).toBe(3.5);
    expect(result.after.plannedGraduation.total?.missing).toBe(0);
    expect(result.after.plannedGraduation.areas).toEqual(result.after.currentGraduation.areas);
    expect(result.after.plannedGraduation.missingRequiredCourses).toEqual(result.after.currentGraduation.missingRequiredCourses);
    state.semesters[0].courses[0].graded = false;
    const edited = simulate(state).result;
    if (!edited.valid) throw new Error('수정된 계획은 유효해야 합니다.');
    expect(edited.after.goal.futureGradedCredits).toBe(129);
  });
});
