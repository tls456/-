import { describe, expect, it } from 'vitest';
import { sumConfirmedEarnedCredits } from './RulesView';
import type { Course } from '../domain/types';

function course(id: string, grade: string, semester = '2025-2', extra: Partial<Course> = {}): Course {
  return { id, name: `과목${id}`, courseCode: `CODE${id}`, categoryId: 'general-free', semester, credits: 3, grade, deletionEligibility: 'eligible', ...extra };
}

describe('삭제기준 취득학점의 명시적 합산', () => {
  it('P와 편입인정은 포함하고 F/N/NP는 제외한다', () => {
    const rows = [course('a', 'A'), course('b', 'P'), course('c', 'B', '2024-1', { transferCredit: true }), course('d', 'F'), course('e', 'N'), course('f', 'NP')];
    expect(sumConfirmedEarnedCredits(rows, '2026-1', 'first')).toMatchObject({ credits: 9, includedCount: 3, excludedCount: 3, error: null });
  });
  it('1차는 이전학기만, 2차는 당해확정성적까지 포함하며 미래는 제외한다', () => {
    const rows = [course('a', 'A', '2025-2'), course('b', 'A', '2026-1'), course('c', 'A', '2026-2')];
    expect(sumConfirmedEarnedCredits(rows, '2026-1', 'first').credits).toBe(3);
    expect(sumConfirmedEarnedCredits(rows, '2026-1', 'second').credits).toBe(6);
  });
  it('삭제자격과 무관하게 실제 취득성적을 합산한다', () => {
    expect(sumConfirmedEarnedCredits([course('a', 'C', '2025-2', { deletionEligibility: 'ineligible' })], '2026-1', 'first').credits).toBe(3);
  });
  it('계절학기와 중복수강을 임의로 포함하거나 제외하지 않는다', () => {
    expect(sumConfirmedEarnedCredits([course('a', 'A', '2025-여름')], '2026-1', 'first').credits).toBeNull();
    expect(sumConfirmedEarnedCredits([course('a', 'F'), course('b', 'A', '2026-1', { name: '과목a' })], '2026-1', 'second').credits).toBeNull();
  });
  it('잘못된 학기·성적·소수학점과 빈목록은 합산하지 않는다', () => {
    expect(sumConfirmedEarnedCredits([course('a', 'A')], '2026-3', 'first').credits).toBeNull();
    expect(sumConfirmedEarnedCredits([course('a', 'W')], '2026-1', 'first').credits).toBeNull();
    expect(sumConfirmedEarnedCredits([course('a', 'A', '2025-2', { credits: 1.5 })], '2026-1', 'first').credits).toBeNull();
    expect(sumConfirmedEarnedCredits([], '2026-1', 'first').credits).toBeNull();
  });
  it('미취득성적만 있으면 명시적인0학점을 허용한다', () => {
    expect(sumConfirmedEarnedCredits([course('a', 'F')], '2026-1', 'first').credits).toBe(0);
  });
});
