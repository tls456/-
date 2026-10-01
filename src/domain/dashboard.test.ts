import { describe, expect, it } from 'vitest';
import { createDemo } from '../demo';
import { defaultAcademic, emptyState } from '../state';
import { simulate } from './simulator';
import { remainingRequirements } from './dashboard';

describe('간단 대시보드의 부족 요건', () => {
  it('충족된 구분을 숨기고 부족학점만 표시한다', () => {
    const computed = simulate(createDemo());
    if (!computed.result.valid) throw new Error('invalid fixture');
    const remaining = remainingRequirements(computed.result.after, computed.profile);
    expect(remaining.areas.every(area => area.missing > 0)).toBe(true);
    expect(remaining.areas.some(area => area.id === 'general-total')).toBe(false);
    expect([...remaining.areas, ...remaining.aggregates].length).toBe(computed.result.after.currentGraduation.areas.filter(area => area.missing > 0).length);
  });
  it('심화교양 선택 영역을 모두 필수로 표시하지 않는다', () => {
    const computed = simulate(emptyState(defaultAcademic(2025)));
    if (!computed.result.valid) throw new Error('invalid fixture');
    const remaining = remainingRequirements(computed.result.after, computed.profile);
    expect(remaining.diversity[0].missingCount).toBe(4);
    expect(remaining.diversity[0].choices).toHaveLength(6);
    expect(remaining.diversity[0].choices.every(choice => choice.missing === 1)).toBe(true);
    expect(remaining.areas.some(area => area.id.startsWith('ge-advanced-'))).toBe(false);
  });
  it('계획의 교양 과목은 미충족 영역 후보에서 제외한다', () => {
    const state = emptyState(defaultAcademic(2025));
    state.semesters = [{ id: 'test', label: 'test', fixedTarget: null, courses: [{ id: 'planned', name: '가상', categoryId: 'ge-advanced-culture', credits: 2, graded: false }] }];
    const computed = simulate(state);
    if (!computed.result.valid) throw new Error('invalid fixture');
    const snapshot = computed.result.after;
    const remaining = remainingRequirements({ ...snapshot, currentGraduation: snapshot.plannedGraduation }, computed.profile, state.semesters[0].courses);
    expect(remaining.diversity[0].missingCount).toBe(3);
    expect(remaining.diversity[0].choices.some(choice => choice.id === 'ge-advanced-culture')).toBe(false);
  });
  it('전공 총량만 있는 복수전공은 실제 부족 요건으로 표시한다', () => {
    const state = emptyState({ ...defaultAcademic(2025), secondaryDepartmentId: 'computer', primaryDepartmentId: '경영학과', secondarySelectionYear: 2025 });
    const computed = simulate(state);
    if (!computed.result.valid) throw new Error('invalid fixture');
    const remaining = remainingRequirements(computed.result.after, computed.profile);
    expect(remaining.areas.some(area => area.id === 'secondary-major-total')).toBe(true);
  });
});
