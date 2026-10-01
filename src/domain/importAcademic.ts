import { GRADES, normalizeGrade, type StudentAcademic } from '../data/academic';
import type { Course } from './types';
import type { Transcript } from './transcript';
import { sumConfirmedEarnedCredits } from './policyCredits';

export interface ImportAcademicProposal {
  baseline: number | null;
  baselineReason: string;
  registeredSemesters: number | null;
  registrationEstimated: boolean;
  registrationReason: string;
}

/** Prefer explicit registration counts; otherwise propose an editable semester-count default. */
export function proposeImportAcademic(transcript: Transcript, courses: Course[], academic: StudentAcademic, applicationTerm: string): ImportAcademicProposal {
  const earned = courses.reduce((sum, course) => sum + (GRADES.find(grade => grade.label === normalizeGrade(course.grade))?.earned ? course.credits : 0), 0);
  const complete = transcript.reportedCredits !== null && earned === transcript.reportedCredits;
  const sum = complete ? sumConfirmedEarnedCredits(courses, applicationTerm, academic.deletionRound) : null;
  const baseline = sum?.credits ?? null;
  const baselineReason = !complete ? '성적표 총 취득학점과 반영할 전체 과목 합계가 일치하지 않아 자동 확정하지 않습니다.'
    : sum?.error ?? `${applicationTerm} ${academic.deletionRound === 'first' ? '1차: 이전 학기까지' : '2차: 당해 학기까지'} 합산 · ${baseline}학점 (F/N 제외, P 포함)`;
  let registeredSemesters = transcript.reportedRegisteredSemesters;
  let registrationEstimated = false;
  let registrationReason = registeredSemesters === null
    ? '성적표에 등록학기 수가 없습니다. 본인이 실제 등록학기 수를 입력·수정해 주세요. 기존 입력값이 있으면 유지합니다.'
    : '성적표에 명시된 등록학기 수';
  const regularTerms = new Set(transcript.rows.map(row => row.course.semester).filter(term => /^\d{4}-[12]$/.test(term)));
  if (registeredSemesters === null && regularTerms.size > 0) {
    registeredSemesters = regularTerms.size + 1;
    registrationEstimated = true;
    registrationReason = `성적표의 서로 다른 정규학기 ${regularTerms.size}개 + 현재 신청학기 1개 = ${registeredSemesters}학기 (추정 기본값 · 1차/2차 동일). 계절학기는 제외합니다. 실제 등록학기와 다르거나 편입 인정학기가 있으면 수정해 주세요.`;
  }
  return { baseline, baselineReason, registeredSemesters, registrationEstimated, registrationReason };
}
