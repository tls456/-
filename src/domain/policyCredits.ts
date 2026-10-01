import { GRADES, normalizeGrade, type StudentAcademic } from '../data/academic';
import type { Course } from './types';

function termOrdinal(value: string): { order: number; seasonal: boolean } | null {
  const match = /^(\d{4})-(1|여름|2|겨울)$/.exec(value.trim());
  if (!match) return null;
  const offsets: Record<string, number> = { '1': 0, '여름': 1, '2': 2, '겨울': 3 };
  return { order: Number(match[1]) * 4 + offsets[match[2]], seasonal: ['여름', '겨울'].includes(match[2]) };
}

/** Sum posted earned credits only. Never treat deletion selection as an actual withdrawal. */
export function sumConfirmedEarnedCredits(courses: Course[], applicationTerm: string, round: StudentAcademic['deletionRound']):
  { credits: number | null; includedCount: number; excludedCount: number; error: string | null } {
  const failure = (error: string) => ({ credits: null, includedCount: 0, excludedCount: 0, error });
  const application = termOrdinal(applicationTerm);
  if (!application || application.seasonal) return failure('신청 학기를 YYYY-1 또는 YYYY-2 형식으로 먼저 확인해 주세요.');
  if (!courses.length) return failure('전체 확정 성적을 먼저 입력해 주세요.');
  let credits = 0;
  let includedCount = 0;
  let excludedCount = 0;
  const codes = new Set<string>();
  const names = new Set<string>();
  for (const course of courses) {
    const semester = termOrdinal(course.semester);
    if (!semester) return failure(`${course.name}: 이수 학기가 올바르지 않아 합산할 수 없습니다.`);
    const inPeriod = semester.order < application.order || (round === 'second' && semester.order === application.order);
    if (!inPeriod) { excludedCount++; continue; }
    if (semester.seasonal) return failure('계절학기의 취득학점 반영 시점은 자동 판단하지 않습니다. 학사시스템의 해당 차수 기준 총 취득학점을 직접 입력해 주세요.');
    if (!Number.isSafeInteger(course.credits) || course.credits <= 0) return failure(`${course.name}: 과목 학점 수를 양의 정수로 확인해 주세요.`);
    const grade = GRADES.find((item) => item.label === normalizeGrade(course.grade));
    if (!grade) return failure(`${course.name}: 확정된 성적 등급을 확인해 주세요.`);
    const code = course.courseCode?.trim().toUpperCase();
    const name = course.name.replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
    if ((code && codes.has(code)) || (name && names.has(name))) return failure('동일 과목으로 보이는 기록이 있습니다. 중복수강·포기 반영 결과를 확인한 뒤 학사시스템의 총 취득학점을 직접 입력해 주세요.');
    if (code) codes.add(code);
    if (name) names.add(name);
    if (grade.earned) { credits += course.credits; includedCount++; }
    else excludedCount++;
  }
  if (!Number.isSafeInteger(credits)) return failure('정확하게 합산할 수 있는 범위를 초과했습니다.');
  return { credits, includedCount, excludedCount, error: null };
}
