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

/** Registration history must be stated in the PDF or entered by the student, never inferred. */
export function proposeImportAcademic(transcript: Transcript, courses: Course[], academic: StudentAcademic, applicationTerm: string): ImportAcademicProposal {
  const earned = courses.reduce((sum, course) => sum + (GRADES.find(grade => grade.label === normalizeGrade(course.grade))?.earned ? course.credits : 0), 0);
  const complete = transcript.reportedCredits !== null && earned === transcript.reportedCredits;
  const sum = complete ? sumConfirmedEarnedCredits(courses, applicationTerm, academic.deletionRound) : null;
  const baseline = sum?.credits ?? null;
  const baselineReason = !complete ? '성적표 총 취득학점과 반영할 전체 과목 합계가 일치하지 않아 자동 확정하지 않습니다.'
    : sum?.error ?? `${applicationTerm} ${academic.deletionRound === 'first' ? '1차: 이전 학기까지' : '2차: 당해 학기까지'} 합산 · ${baseline}학점 (F/N 제외, P 포함)`;
  const registeredSemesters = transcript.reportedRegisteredSemesters;
  const registrationEstimated = false;
  const registrationReason = registeredSemesters === null
    ? '성적표에 등록학기 수가 없습니다. 본인이 실제 등록학기 수를 입력·수정해 주세요. 기존 입력값이 있으면 유지합니다.'
    : '성적표에 명시된 등록학기 수';
  return { baseline, baselineReason, registeredSemesters, registrationEstimated, registrationReason };
}
