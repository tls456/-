import type { Semester } from './types';

export const UNCLASSIFIED_PLAN_CATEGORY = 'plan-unclassified';

/** A GPA-only placeholder plan, not evidence of area or required-course completion. */
export function createAutoPlan(remainingCredits: number, startTerm: string): Semester[] {
  const match = /^(\d{4})-([12])$/.exec(startTerm);
  if (!match || !Number.isSafeInteger(remainingCredits) || remainingCredits < 0 || remainingCredits > 540) {
    throw new Error('자동 계획은 정규학기 시작일과 0~540 사이의 정수 학점이 필요합니다.');
  }
  const semesters: Semester[] = [];
  let remaining = remainingCredits;
  let courseNumber = 1;
  let termNumber = Number(match[1]) * 2 + Number(match[2]) - 1;
  while (remaining > 0) {
    const credits = Math.min(18, remaining);
    const semester: Semester = { id: crypto.randomUUID(), label: `${Math.floor(termNumber / 2)}-${termNumber % 2 + 1}`, fixedTarget: null, courses: [] };
    for (let pending = credits; pending > 0;) {
      const size = Math.min(3, pending);
      semester.courses.push({ id: crypto.randomUUID(), name: `가상 과목 ${courseNumber++}`, categoryId: UNCLASSIFIED_PLAN_CATEGORY, credits: size, graded: true });
      pending -= size;
    }
    semesters.push(semester);
    remaining -= credits;
    termNumber++;
  }
  return semesters;
}
