import { calculateDeletionPolicy, GRADES, prepareCoursesForDeletion } from '../data/academic';
import type { AppState } from '../state';
import { buildProfile } from './buildProfile';
import { calculateScenario } from './engine';
import { applyPersonalRequirements } from './personal';
import type { ScenarioInput, ScenarioResult, ValidationIssue } from './types';

export function simulate(state: AppState) {
  const officialProfile = buildProfile(state.academic);
  const profile = applyPersonalRequirements(officialProfile, state.academic, state.personalRequirements);
  const policy = calculateDeletionPolicy(state.academic, { totalGraduationCredits: profile.graduationRule.totalCredits });
  const input: ScenarioInput = {
    grades: GRADES,
    courses: prepareCoursesForDeletion(state.courses, state.applicationTerm, state.academic.deletionRound),
    semesters: state.semesters,
    graduationRule: profile.graduationRule,
    deletionPolicy: policy,
    selectedCourseIds: state.selectedCourseIds,
    targetGpa: state.targetGpa,
  };
  const categoryIds = new Set(profile.categories.map(category => category.id));
  const extraIssues: ValidationIssue[] = [];
  for (const [index, course] of state.courses.entries()) {
    if (!categoryIds.has(course.categoryId)) extraIssues.push({ path: `courses.${index}.categoryId`, message: `${course.name}: 현재 교육과정에 없는 과목 구분입니다. 입력 수정을 통해 다시 선택해 주세요.` });
  }
  for (const [index, semester] of state.semesters.entries()) {
    for (const [courseIndex, course] of semester.courses.entries()) {
      if (!categoryIds.has(course.categoryId)) extraIssues.push({ path: `semesters.${index}.courses.${courseIndex}.categoryId`, message: `${semester.label} ${course.name}: 현재 교육과정에 맞는 과목 구분을 선택해 주세요.` });
    }
  }
  const result: ScenarioResult = extraIssues.length ? { valid: false, issues: extraIssues } : calculateScenario(input);
  return { profile, officialProfile, policy, input, result };
}
