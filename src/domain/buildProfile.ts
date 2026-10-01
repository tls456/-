import {
  getCurriculumYear,
  getSecondaryCurriculumYear,
  OFFICIAL_SOURCES,
  type StudentAcademic,
} from '../data/academic';
import {
  GENERAL_EDUCATION_BY_YEAR,
  getDepartmentCurriculum,
  type CatalogCourse,
  type DepartmentCurriculum,
  type GeneralEducationProfile,
} from '../data/catalog';
import type { GraduationArea, GraduationRule, RequiredCourse } from './types';

export interface Source {
  id: string;
  title: string;
  url: string;
  locator?: string;
  pdfUrl?: string;
  pdfPage?: number;
  printedPage?: number;
  revision?: string;
  publishedAt?: string;
  checkedAt?: string;
}

export interface ProfileCategory { id: string; label: string }
export interface ProfileCourseOption { code: string; name: string; credits: number; categoryId: string }

export interface BuiltProfile {
  graduationRule: GraduationRule;
  categories: ProfileCategory[];
  courseOptions: ProfileCourseOption[];
  primary: DepartmentCurriculum | null;
  secondary: DepartmentCurriculum | null;
  curriculumYear: number | null;
  secondaryYear: number | null;
  sources: Source[];
  notices: string[];
}

const advancedLabels: Record<string, string> = {
  'ge-advanced-language': '심화교양 · 글로벌언어',
  'ge-advanced-culture': '심화교양 · 인간과문화',
  'ge-advanced-society': '심화교양 · 인간과사회',
  'ge-advanced-science': '심화교양 · 과학과기술',
  'ge-advanced-arts': '심화교양 · 예술과체육',
  'ge-advanced-convergence': '심화교양 · 융복합',
};

function uniqueSources(sources: Source[]): Source[] {
  return [...new Map(sources.map((source) => [source.id, source])).values()];
}

function courseOption(course: CatalogCourse, role: 'primary' | 'secondary'): ProfileCourseOption {
  return {
    code: course.code,
    name: course.name,
    credits: course.credits,
    categoryId: course.category === 'major-common' ? `${role}-common` : `${role}-required`,
  };
}

function requiredCourse(course: CatalogCourse, prefix: string): RequiredCourse {
  return { id: `${prefix}-${course.code}`, label: course.name, alternatives: [course.code] };
}

function addMajorCategories(categories: ProfileCategory[], department: DepartmentCurriculum | null, role: 'primary' | 'secondary') {
  const name = department?.name ?? (role === 'primary' ? '원전공' : '다전공');
  categories.push(
    { id: `${role}-required`, label: `${name} · 전공필수` },
    { id: `${role}-elective`, label: `${name} · 전공선택` },
  );
  if (department?.commonRequiredCredits) categories.push({ id: `${role}-common`, label: `${name} · 학부 공통필수` });
}

function majorCategoryIds(role: 'primary' | 'secondary', department: DepartmentCurriculum): string[] {
  return [`${role}-required`, `${role}-elective`, ...(department.commonRequiredCredits ? [`${role}-common`] : [])];
}

function addMajorCourseOptions(
  options: ProfileCourseOption[], department: DepartmentCurriculum, role: 'primary' | 'secondary',
) {
  options.push(...department.requiredCourses.map((course) => courseOption(course, role)));
  // The catalog is expanded independently; choices remain choices, never single-course requirements.
  const choices = (department as DepartmentCurriculum & { requiredCourseChoices?: CatalogCourse[] }).requiredCourseChoices ?? [];
  options.push(...choices.map((course) => courseOption(course, role)));
}

function addSingleMajorRules(rule: GraduationRule, department: DepartmentCurriculum) {
  const requiredCategories = ['primary-required', ...(department.commonRequiredCredits ? ['primary-common'] : [])];
  rule.areas.push(
    { id: 'primary-major-total', label: `${department.name} 전공 합계`, minCredits: department.majorCredits, categoryIds: majorCategoryIds('primary', department) },
    { id: 'primary-major-required', label: `${department.name} 전공필수`, minCredits: department.majorRequiredCredits, categoryIds: requiredCategories },
    { id: 'primary-major-elective', label: `${department.name} 전공선택`, minCredits: department.majorElectiveCredits, categoryIds: ['primary-elective'] },
  );
  if (department.commonRequiredCredits) {
    rule.areas.push({ id: 'primary-major-common', label: '학부 공통필수', minCredits: department.commonRequiredCredits, categoryIds: ['primary-common'] });
  }
  rule.requiredCourses.push(...department.requiredCourses.map((course) => requiredCourse(course, 'primary')));
  rule.requiredCourses.push(...department.requiredCourseGroups.map((group) => ({
    id: `primary-${group.id}`, label: group.label, alternatives: group.codes, minimumCount: group.minCount,
  })));
}

function addGeneralEducation(
  rule: GraduationRule,
  categories: ProfileCategory[],
  options: ProfileCourseOption[],
  profile: GeneralEducationProfile,
  primary: DepartmentCurriculum,
  academic: StudentAcademic,
  notices: string[],
) {
  categories.push(...profile.areas.map((area) => ({ id: area.id, label: area.label })));
  categories.push(...profile.advancedAreaIds.map((id) => ({ id, label: advancedLabels[id] ?? id })));
  categories.push({ id: 'ge-other', label: '교양 · 추가 인정학점' });
  options.push(...profile.requiredCourses.map((course) => ({
    code: course.code, name: course.name, credits: course.credits, categoryId: course.category,
  })));
  notices.push(...profile.notes);

  if (academic.admissionType === 'transfer') {
    rule.unknownReasons.push('편입생의 교양 인정·면제와 학과 지정 보충과목은 개인별 학점인정 내역 확인이 필요합니다.');
    notices.push('편입생에게 신입생의 교양 세부요건을 일괄 적용하지 않았습니다. 인정학점은 성적표의 최종 이수구분으로 입력해 주세요.');
    return;
  }

  const allGeneralCategories = [...profile.areas.map((area) => area.id), ...profile.advancedAreaIds, 'ge-other'];
  rule.areas.push({ id: 'general-total', label: '교양 총 이수학점', minCredits: primary.generalCredits, categoryIds: allGeneralCategories });

  // Nursing/medicine have department-specific general education exceptions. Their
  // total is known, but applying the common leaf requirements would be incorrect.
  if (['간호학과', '의예과', '의학과'].includes(primary.name)) {
    rule.unknownReasons.push(`${primary.name}의 교양 영역별 예외 및 필수과목은 해당 학과 기준 확인이 필요합니다.`);
    return;
  }
  const coreIds = profile.areas.filter((area) => !['ge-personality', 'ge-practical', 'ge-activity'].includes(area.id)).map((area) => area.id);
  rule.areas.push(
    { id: 'general-core', label: '기초교양 합계', minCredits: profile.coreCredits, categoryIds: coreIds },
    { id: 'general-advanced', label: '심화교양 합계', minCredits: profile.advancedCredits, categoryIds: profile.advancedAreaIds },
    ...profile.areas.map((area): GraduationArea => ({ id: area.id, label: area.label, minCredits: area.minCredits, categoryIds: [area.id] })),
  );
  rule.categoryDiversity = [{
    id: 'general-advanced-diversity',
    label: '심화교양 이수 영역 수',
    categoryIds: profile.advancedAreaIds,
    minCount: profile.advancedMinimumAreaCount,
    minCreditsPerCategory: 1,
  }];
  rule.requiredCourses.push(...profile.requiredCourses.map((course) => requiredCourse(course, 'general')));

  // Official GE footnotes require both science courses for these cohorts:
  // 2020 pp.509–510; 2021 pp.305–306; 2022 p.317; 2023 p.315; 2024 p.32.
  // Keep the published overall/core minima; the two 3-credit requirements make
  // the science subtotal 6 without inventing a revised core total.
  const requiresBioFoundation = (profile.year === 2020
    && ['바이오의약학전공', '바이오생명공학전공'].includes(primary.name))
    || (profile.year >= 2021 && profile.year <= 2024 && primary.name === '바이오의약학과');
  if (requiresBioFoundation) {
    const bioCourses: CatalogCourse[] = [
      { code: 'BKSA59512', name: '대학기초생물학', credits: 3, category: 'ge-science' },
      { code: 'BKSA58224', name: '대학기초화학', credits: 3, category: 'ge-science' },
    ];
    const science = rule.areas.find((area) => area.id === 'ge-science');
    if (science) science.minCredits = 6;
    rule.requiredCourses.push(...bioCourses.map((course) => requiredCourse(course, 'general')));
    options.push(...bioCourses.map((course) => ({
      code: course.code, name: course.name, credits: course.credits, categoryId: course.category,
    })));
    notices.push(`${primary.name} ${profile.year} 교육과정은 대학기초생물학과 대학기초화학을 각각 필수 이수합니다.`);
  }

  const designDepartment = ['산업디자인', '실내디자인', '패션디자인', '시각영상디자인', '미디어콘텐츠', '조형예술']
    .some((name) => primary.name.startsWith(name));
  if (designDepartment && profile.year >= 2025) {
    notices.push('디자인대학의 과학기초 대체 이수는 승인된 한 영역에만 입력해 주세요. 같은 학점을 심화교양에 중복 반영하지 않습니다.');
  }
}

/** Convert only source-confirmed requirements; missing individual decisions remain explicit. */
export function buildProfile(academic: StudentAcademic): BuiltProfile {
  const primaryYear = getCurriculumYear(academic);
  const secondYear = getSecondaryCurriculumYear(academic);
  const primary = primaryYear.year == null ? null : getDepartmentCurriculum(academic.primaryDepartmentId, primaryYear.year) ?? null;
  const secondary = !academic.secondaryDepartmentId || secondYear.year == null
    ? null : getDepartmentCurriculum(academic.secondaryDepartmentId, secondYear.year) ?? null;
  const dual = academic.secondaryDepartmentId != null;
  const categories: ProfileCategory[] = [];
  const courseOptions: ProfileCourseOption[] = [];
  const sources: Source[] = [...OFFICIAL_SOURCES];
  const notices: string[] = [];
  const rule: GraduationRule = {
    totalCredits: primary?.totalCredits ?? null,
    areas: [],
    requiredCourses: [],
    categoryDiversity: [],
    unknownReasons: [...primaryYear.unknownReasons, ...secondYear.unknownReasons],
    nonCreditRequirements: [],
  };

  addMajorCategories(categories, primary, 'primary');
  if (dual) addMajorCategories(categories, secondary, 'secondary');
  if (!primary) rule.unknownReasons.push('선택한 원전공과 교육과정 연도가 일치하는 공식 졸업기준을 확인하지 못했습니다.');
  if (dual && !secondary) rule.unknownReasons.push('다전공의 선발연도와 해당 학과 졸업기준을 확인해 주세요.');
  if (academic.primaryDepartmentId !== 'computer' && academic.secondaryDepartmentId !== 'computer') {
    rule.unknownReasons.push('현재 제공 범위는 컴퓨터공학과가 원전공 또는 다전공에 포함된 조합입니다.');
  }
  if (dual && academic.primaryDepartmentId === academic.secondaryDepartmentId) {
    rule.unknownReasons.push('원전공과 동일한 학과를 다전공으로 선택할 수 없습니다.');
  }

  if (primary) {
    sources.push(...primary.sources);
    addMajorCourseOptions(courseOptions, primary, 'primary');
    rule.unknownReasons.push(...primary.unknownReasons);
    rule.nonCreditRequirements!.push(...primary.nonCreditRequirements);
    if (dual) {
      rule.areas.push({ id: 'primary-major-total', label: `${primary.name} 원전공`, minCredits: 40, categoryIds: majorCategoryIds('primary', primary) });
      rule.unknownReasons.push(`${primary.name} 다전공 이수자의 원전공 전공필수 적용 여부는 학과 확인이 필요합니다.`);
      notices.push('다전공 이수 시 원전공은 확인된 공통 기준인 전공 합계 40학점을 적용합니다. 전공필수 면제를 확정한 것은 아닙니다.');
      if (primary.name === '유아교육과') {
        rule.unknownReasons.push('유아교육과 다전공 이수자의 원전공·교직 학점 기준은 별도 확인이 필요합니다.');
      }
    } else addSingleMajorRules(rule, primary);
    const general = GENERAL_EDUCATION_BY_YEAR[primary.year];
    addGeneralEducation(rule, categories, courseOptions, general, primary, academic, notices);
    sources.push(...general.sources);
  }

  if (secondary) {
    sources.push(...secondary.sources);
    addMajorCourseOptions(courseOptions, secondary, 'secondary');
    rule.nonCreditRequirements!.push(...secondary.nonCreditRequirements);
    if (secondary.doubleMajorCredits == null) {
      rule.unknownReasons.push(`${secondary.name}은 해당 요람에서 다전공 이수학점을 제시하지 않습니다. 선발 가능 여부부터 확인해야 합니다.`);
    } else {
      rule.areas.push({ id: 'secondary-major-total', label: `${secondary.name} 다전공`, minCredits: secondary.doubleMajorCredits, categoryIds: majorCategoryIds('secondary', secondary) });
    }
    rule.unknownReasons.push(`${secondary.name} 다전공의 별도 전공필수·지정교양 및 인정과목 지침 확인이 필요합니다.`);
    notices.push('다전공은 선발연도 요람을 적용합니다. 일반 신입생용 전공필수 과목을 다전공 필수로 자동 지정하지 않았습니다.');
  }

  if (dual) {
    notices.push('한 과목은 하나의 이수구분으로 계산합니다. 원전공과 다전공 간 중복 인정은 학교에서 확정된 내용만 반영해 주세요.');
    if ([primary?.name, secondary?.name].some((name) => name && ['간호학과', '의예과', '의학과', '국제경영학과', '미디어영상학과'].includes(name))) {
      rule.unknownReasons.push('선택한 학과에는 다전공 전입·전출 제한이 있습니다. 해당 선발연도의 허가 내역을 확인해 주세요.');
    }
    if (secondary && ['산업디자인', '실내디자인', '패션디자인', '시각영상디자인', '미디어콘텐츠', '조형예술']
      .some((name) => secondary.name.startsWith(name))) {
      rule.unknownReasons.push('일반학과에서 미술계 학과로의 다전공 전입 제한이 있으므로 이 조합의 선발 허가를 확인해야 합니다.');
    }
  }
  if (academic.admissionType === 'transfer') {
    rule.unknownReasons.push('편입 전적대의 인정학점과 본교 필수·보충 이수과목은 개인별 승인 내역을 확인해야 합니다.');
    notices.push('편입 인정학점은 GPA에서 제외되고 취득학점포기 대상이 아닙니다. 승인된 이수구분 및 과목명으로 입력해 주세요.');
  } else if (academic.admissionType === 'major-change') {
    rule.unknownReasons.push('전과 전 이수과목의 일반선택 전환 및 새 전공 인정 내역은 개인별 이수구분 정정 결과 확인이 필요합니다.');
    notices.push('전과 후 학과의 확인된 교육과정 기준입니다. 이전 학과 과목을 새 전공으로 임의 인정하지 않습니다.');
  }

  categories.push({ id: 'general-free', label: '일반선택' });
  rule.unknownReasons = [...new Set(rule.unknownReasons)];
  rule.nonCreditRequirements = [...new Set(rule.nonCreditRequirements)];
  return {
    graduationRule: rule,
    categories: [...new Map(categories.map((category) => [category.id, category])).values()],
    courseOptions: [...new Map(courseOptions.map((course) => [`${course.categoryId}:${course.code}`, course])).values()],
    primary,
    secondary,
    curriculumYear: primaryYear.year,
    secondaryYear: secondYear.year,
    sources: uniqueSources(sources),
    notices: [...new Set(notices)],
  };
}
