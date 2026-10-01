import type { StudentAcademic } from '../data/academic';
import type { BuiltProfile } from './buildProfile';
import type { GraduationArea, RequiredCourse } from './types';

/** User-recorded school confirmation, never an automatically verified official rule. */
export interface PersonalRequirements {
  contextKey: string;
  sourceNote: string;
  checkedAt: string;
  requiredCourses: RequiredCourse[];
  areas: GraduationArea[];
  exemptRequirementIds: string[];
  confirmedUnknownReasons: string[];
  confirmedNonCreditRequirements: string[];
}

/** Deletion settings are deliberately excluded: they do not change a curriculum. */
export function getPersonalContextKey(academic: StudentAcademic): string {
  return JSON.stringify({
    version: 1,
    entryYear: academic.entryYear,
    admissionType: academic.admissionType,
    curriculumYear: academic.curriculumYear ?? null,
    transferAdmissionYear: academic.transferAdmissionYear ?? null,
    transferEntryGrade: academic.transferEntryGrade ?? null,
    primaryDepartmentId: academic.primaryDepartmentId,
    secondaryDepartmentId: academic.secondaryDepartmentId,
    secondarySelectionYear: academic.secondarySelectionYear,
  });
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 1000): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const uniqueTexts = (value: unknown, max = 1000): value is string[] => Array.isArray(value)
  && value.length <= 500 && value.every((item) => text(item, max)) && new Set(value).size === value.length;
const safeInteger = (value: unknown, minimum = 0): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;

export function isConfirmationDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Structural/semantic validation for JSON restore. This cannot authenticate a school document. */
export function isPersonalRequirements(value: unknown): value is PersonalRequirements {
  if (!object(value) || !text(value.contextKey, 10000) || !text(value.sourceNote, 4000) || !isConfirmationDate(value.checkedAt)) return false;
  if (!Array.isArray(value.requiredCourses) || value.requiredCourses.length > 500
    || !Array.isArray(value.areas) || value.areas.length > 500) return false;
  if (!value.requiredCourses.every((course) => object(course)
    && text(course.id, 200) && text(course.label, 1000)
    && uniqueTexts(course.alternatives, 200) && course.alternatives.length > 0
    && (course.minimumCount === undefined || (safeInteger(course.minimumCount, 1) && course.minimumCount <= course.alternatives.length)))) return false;
  if (!value.areas.every((area) => object(area) && text(area.id, 200) && text(area.label, 1000)
    && safeInteger(area.minCredits) && uniqueTexts(area.categoryIds, 200) && area.categoryIds.length > 0)) return false;
  const ids = [...value.requiredCourses, ...value.areas].map((item) => (item as { id: string }).id);
  if (new Set(ids).size !== ids.length) return false;
  return uniqueTexts(value.exemptRequirementIds, 200)
    && uniqueTexts(value.confirmedUnknownReasons, 4000)
    && uniqueTexts(value.confirmedNonCreditRequirements, 4000);
}

/** Validate the complete set atomically; stale references never become silent exemptions. */
export function validatePersonalRequirements(profile: BuiltProfile, academic: StudentAcademic, value: unknown): string[] {
  if (!isPersonalRequirements(value)) return ['개인 확인내용의 형식, 출처, 확인일 또는 학점·과목 수가 올바르지 않습니다. 내용을 다시 확인해 주세요.'];
  const issues: string[] = [];
  if (value.contextKey !== getPersonalContextKey(academic)) issues.push('학적·교육과정이 바뀌었습니다. 저장된 개인 확인내용을 현재 학적에 맞게 다시 확인하고 적용해 주세요.');
  const categories = new Set(profile.categories.map((item) => item.id));
  const existingAreas = new Map(profile.graduationRule.areas.map((area) => [area.id, area]));
  const existingCourseIds = new Set(profile.graduationRule.requiredCourses.map((course) => course.id));
  for (const area of value.areas) {
    if (!existingAreas.has(area.id) && !area.id.startsWith('personal-area-')) issues.push(`‘${area.label}’의 기존 영역을 찾지 못했습니다. 현재 교육과정으로 다시 입력해 주세요.`);
    if (existingCourseIds.has(area.id) || area.categoryIds.some((id) => !categories.has(id))) issues.push(`‘${area.label}’에 현재 교육과정에 없는 과목 구분이 있습니다.`);
    if (value.exemptRequirementIds.includes(area.id)) issues.push(`‘${area.label}’에 최소학점 변경과 면제가 동시에 지정되어 있습니다. 하나만 선택해 주세요.`);
  }
  for (const course of value.requiredCourses) {
    if (!course.id.startsWith('personal-course-') || existingCourseIds.has(course.id) || existingAreas.has(course.id)) issues.push(`‘${course.label}’은 개인 추가 필수요건으로 새로 입력해 주세요. 기존 필수 변경은 면제와 대체요건 추가로 기록합니다.`);
  }
  if (value.exemptRequirementIds.some((id) => !existingAreas.has(id) && !existingCourseIds.has(id))) issues.push('현재 교육과정에 없는 면제 대상이 있습니다. 이전 면제 항목을 제거하고 다시 선택해 주세요.');
  if (value.confirmedUnknownReasons.some((reason) => !profile.graduationRule.unknownReasons.includes(reason))) issues.push('현재 내용과 다른 미확정 요건의 확인 기록이 있습니다. 이전 확인 표시를 제거하고 현재 요건을 다시 확인해 주세요.');
  if (value.confirmedNonCreditRequirements.some((reason) => !profile.graduationRule.nonCreditRequirements?.includes(reason))) issues.push('현재 내용과 다른 비학점 요건의 확인 기록이 있습니다. 이전 확인 표시를 제거하고 현재 요건을 다시 확인해 주세요.');
  return [...new Set(issues)];
}

export function applyPersonalRequirements(profile: BuiltProfile, academic: StudentAcademic, personal?: PersonalRequirements): BuiltProfile {
  if (personal === undefined) return profile;
  const issues = validatePersonalRequirements(profile, academic, personal);
  if (issues.length) {
    return {
      ...profile,
      graduationRule: {
        ...profile.graduationRule,
        unknownReasons: [...new Set([...profile.graduationRule.unknownReasons, ...issues.map((issue) => `개인 확인내용 미적용: ${issue}`)])],
      },
      notices: [...profile.notices, '저장된 개인 확인내용은 보존했지만 검증되지 않아 계산에 전혀 적용하지 않았습니다.'],
    };
  }
  const exempt = new Set(personal.exemptRequirementIds);
  const replacements = new Map(personal.areas.map((area) => [area.id, area]));
  const originalIds = new Set(profile.graduationRule.areas.map((area) => area.id));
  const areas = profile.graduationRule.areas.filter((area) => !exempt.has(area.id)).map((area) => ({
    ...area,
    // An existing area override changes only its minimum, never its category meaning.
    minCredits: replacements.get(area.id)?.minCredits ?? area.minCredits,
    categoryIds: [...area.categoryIds],
  }));
  areas.push(...personal.areas.filter((area) => !originalIds.has(area.id)).map((area) => ({ ...area, categoryIds: [...area.categoryIds] })));
  return {
    ...profile,
    graduationRule: {
      ...profile.graduationRule,
      areas,
      requiredCourses: [
        ...profile.graduationRule.requiredCourses.filter((course) => !exempt.has(course.id)),
        ...personal.requiredCourses,
      ].map((course) => ({ ...course, alternatives: [...course.alternatives] })),
      unknownReasons: profile.graduationRule.unknownReasons.filter((reason) => !personal.confirmedUnknownReasons.includes(reason)),
      nonCreditRequirements: profile.graduationRule.nonCreditRequirements?.filter((reason) => !personal.confirmedNonCreditRequirements.includes(reason)),
    },
    // User-supplied evidence is recorded in notices, not promoted to official sources.
    notices: [...profile.notices,
      `사용자 입력 개인 확인자료 (${personal.checkedAt}): ${personal.sourceNote}`,
      `개인 적용: 추가 필수 ${personal.requiredCourses.length}개, 영역 추가·최소학점 변경 ${personal.areas.length}개, 면제 ${personal.exemptRequirementIds.length}개, 미확정 사항 확인 ${personal.confirmedUnknownReasons.length}개, 비학점 충족 확인 ${personal.confirmedNonCreditRequirements.length}개.`,
      '개인 확인자료는 사용자가 기록한 내용이며 학교가 앱을 통해 인증한 공식 규정이 아닙니다. 과목·학점 인정이나 졸업의 최종 판단은 학교에 있습니다.',
    ],
  };
}
