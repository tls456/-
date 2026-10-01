import type {
  Course,
  CourseEligibilityResult,
  CreditRequirementResult,
  DeletionResult,
  ExactRatio,
  GoalResult,
  GraduationResult,
  ScenarioInput,
  ScenarioResult,
  ScenarioSnapshot,
  Totals,
  ValidationIssue,
} from './types';

// All grade contributions and comparisons use integer thousandths. Display strings
// never feed back into a calculation. Integer credit inputs keep ratios exact.
const SCALE = 1000;
const scaled = (value: number): number => Math.round(value * SCALE);
const nonnegativeInteger = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;
const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const hasPrecision = (value: number): boolean =>
  Number.isFinite(value) && Math.abs(value * SCALE - scaled(value)) < 1e-8;

/** Exact half-up formatting for nonnegative GPA ratios. */
function roundRatio(ratio: ExactRatio, places: number): string {
  const power = 10 ** places;
  const negative = ratio.numerator < 0;
  const numerator = Math.abs(ratio.numerator) * power;
  const whole = Math.floor(numerator / ratio.denominator);
  const rounded = whole + (2 * (numerator % ratio.denominator) >= ratio.denominator ? 1 : 0);
  return `${negative && rounded !== 0 ? '-' : ''}${(rounded / power).toFixed(places)}`;
}

function ceilRatio(ratio: ExactRatio, places: number): string {
  const power = 10 ** places;
  const numerator = ratio.numerator * power;
  const quotient = Math.trunc(numerator / ratio.denominator);
  const ceil = quotient + (numerator > 0 && numerator % ratio.denominator !== 0 ? 1 : 0);
  return (ceil / power).toFixed(places);
}

export function formatGpa(value: number | ExactRatio | null): string {
  if (value === null) return '산정 대상 없음';
  if (typeof value === 'object') return roundRatio(value, 2);
  return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);
}

export function formatRequiredAverage(value: number | ExactRatio | null): string {
  if (value === null) return '산정 대상 없음';
  if (typeof value === 'object') return ceilRatio(value, 3);
  return (Math.ceil(value * 1000 - 1e-10) / 1000).toFixed(3);
}

export function validateScenario(input: ScenarioInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  const grades = new Map<string, number>();
  input.grades.forEach((grade, index) => {
    const path = `grades.${index}`;
    if (!hasText(grade.label)) add(`${path}.label`, '등급 이름을 입력해 주세요.');
    if (grades.has(grade.label)) add(`${path}.label`, '등급 이름이 중복되었습니다.');
    grades.set(grade.label, index);
    if (typeof grade.earned !== 'boolean') add(`${path}.earned`, '이수 인정 여부를 확인해 주세요.');
    if (grade.points !== null && (!hasPrecision(grade.points) || grade.points < 0)) {
      add(`${path}.points`, '환산 평점은 0 이상의 소수 셋째 자리 이내 값이어야 합니다.');
    }
  });
  if (input.grades.length === 0) add('grades', '등급 환산표가 필요합니다.');
  const points = input.grades.flatMap((grade) => grade.points === null ? [] : [grade.points]);
  const minimum = points.length ? Math.min(...points) : 0;
  const maximum = points.length ? Math.max(...points) : 0;
  const checkTarget = (target: number | null, path: string) => {
    if (target === null) return;
    if (!hasPrecision(target) || points.length === 0 || target < minimum || target > maximum) {
      add(path, `목표 평균평점은 환산표 범위(${minimum}~${maximum}) 안의 소수 셋째 자리 이내 값이어야 합니다.`);
    }
  };
  checkTarget(input.targetGpa, 'targetGpa');
  const ids = new Set<string>();
  const checkId = (id: string, path: string) => {
    if (!hasText(id)) add(path, '과목 ID가 필요합니다.');
    if (ids.has(id)) add(path, '과목 ID가 중복되었습니다. 서로 다른 수강 기록에는 다른 ID를 사용해 주세요.');
    ids.add(id);
  };
  const checkCourseFields = (course: { id: string; name: string; categoryId: string; credits: number }, path: string) => {
    checkId(course.id, `${path}.id`);
    if (!hasText(course.name)) add(`${path}.name`, '과목명을 입력해 주세요.');
    if (!hasText(course.categoryId)) add(`${path}.categoryId`, '과목 구분을 선택해 주세요.');
    if (!Number.isSafeInteger(course.credits) || course.credits <= 0) {
      add(`${path}.credits`, '과목 학점 수는 양의 정수여야 합니다. 소수 학점은 지원하지 않습니다.');
    }
  };
  input.courses.forEach((course, index) => {
    const path = `courses.${index}`;
    checkCourseFields(course, path);
    if (!hasText(course.semester)) add(`${path}.semester`, '이수 학기를 입력해 주세요.');
    if (!grades.has(course.grade)) add(`${path}.grade`, '환산표에 없는 등급입니다.');
    if (!['eligible', 'ineligible', 'unknown'].includes(course.deletionEligibility)) {
      add(`${path}.deletionEligibility`, '삭제 자격 상태를 확인해 주세요.');
    }
  });
  const semesterIds = new Set<string>();
  input.semesters.forEach((semester, semesterIndex) => {
    const path = `semesters.${semesterIndex}`;
    if (!hasText(semester.id) || semesterIds.has(semester.id)) add(`${path}.id`, '고유한 학기 ID가 필요합니다.');
    semesterIds.add(semester.id);
    if (!hasText(semester.label)) add(`${path}.label`, '학기 이름을 입력해 주세요.');
    checkTarget(semester.fixedTarget, `${path}.fixedTarget`);
    semester.courses.forEach((course, index) => {
      checkCourseFields(course, `${path}.courses.${index}`);
      if (typeof course.graded !== 'boolean') add(`${path}.courses.${index}.graded`, '평점 반영 여부가 필요합니다.');
      if (course.graded && points.length === 0) add(`${path}.courses.${index}.graded`, '평점 과목을 계산할 등급 환산표가 없습니다.');
    });
    if (semester.fixedTarget !== null && !semester.courses.some((course) => course.graded)) {
      add(`${path}.fixedTarget`, '평점 산정 과목이 없는 학기에는 목표를 고정할 수 없습니다.');
    }
  });
  const allCredits = [...input.courses, ...input.semesters.flatMap((semester) => semester.courses)]
    .reduce((sum, course) => sum + course.credits, 0);
  if (!Number.isSafeInteger(allCredits * Math.max(1, scaled(maximum)) * 1000)) {
    add('courses', '정확하게 계산할 수 있는 입력 범위를 초과했습니다.');
  }
  const selectedIds = new Set<string>();
  const currentIds = new Set(input.courses.map((course) => course.id));
  input.selectedCourseIds.forEach((id, index) => {
    if (selectedIds.has(id)) add(`selectedCourseIds.${index}`, '삭제 선택 ID가 중복되었습니다.');
    if (!currentIds.has(id)) add(`selectedCourseIds.${index}`, '삭제 선택 과목이 현재 이수 기록에 없습니다.');
    selectedIds.add(id);
  });
  const rule = input.graduationRule;
  if (rule.totalCredits !== null && !nonnegativeInteger(rule.totalCredits)) add('graduationRule.totalCredits', '졸업 최소 학점 수는 0 이상의 정수여야 합니다.');
  const ruleIds = new Set<string>();
  rule.areas.forEach((area, index) => {
    if (!hasText(area.id) || ruleIds.has(area.id)) add(`graduationRule.areas.${index}.id`, '영역 기준의 고유 ID가 필요합니다.');
    ruleIds.add(area.id);
    if (!nonnegativeInteger(area.minCredits)) add(`graduationRule.areas.${index}.minCredits`, '영역 최소 학점 수는 0 이상의 정수여야 합니다.');
    if (area.categoryIds.length === 0 || area.categoryIds.some((id) => !hasText(id))) add(`graduationRule.areas.${index}.categoryIds`, '검사할 과목 구분이 필요합니다.');
  });
  rule.requiredCourses.forEach((course, index) => {
    const codes = new Set(course.alternatives);
    if (codes.size === 0 || course.alternatives.some((code) => !hasText(code))) add(`graduationRule.requiredCourses.${index}.alternatives`, '필수 과목 코드가 필요합니다.');
    if (course.minimumCount !== undefined && (!Number.isSafeInteger(course.minimumCount) || course.minimumCount <= 0 || course.minimumCount > codes.size)) {
      add(`graduationRule.requiredCourses.${index}.minimumCount`, '필수 이수 과목 수를 대체 과목 코드 수 이내의 양의 정수로 입력해 주세요.');
    }
  });
  rule.categoryDiversity?.forEach((group, index) => {
    const categoryIds = new Set(group.categoryIds);
    if (categoryIds.size === 0 || group.categoryIds.some((id) => !hasText(id))) add(`graduationRule.categoryDiversity.${index}.categoryIds`, '영역 선택 기준의 과목 구분이 필요합니다.');
    if (!Number.isSafeInteger(group.minCount) || group.minCount <= 0 || group.minCount > categoryIds.size) add(`graduationRule.categoryDiversity.${index}.minCount`, '최소 이수 영역 수가 검사 영역 범위를 벗어났습니다.');
    if (group.minCreditsPerCategory !== undefined && (!Number.isSafeInteger(group.minCreditsPerCategory) || group.minCreditsPerCategory <= 0)) add(`graduationRule.categoryDiversity.${index}.minCreditsPerCategory`, '영역별 인정 학점 수는 양의 정수여야 합니다.');
  });
  const policy = input.deletionPolicy;
  (['creditLimit', 'usedCredits', 'maxCourses', 'usedCourses', 'earnedCreditFloor'] as const).forEach((key) => {
    const value = policy[key];
    if (value !== undefined && value !== null && !nonnegativeInteger(value)) add(`deletionPolicy.${key}`, '삭제 한도와 사용량은 0 이상의 정수여야 합니다.');
  });
  if (policy.creditLimit !== null && policy.usedCredits > policy.creditLimit) add('deletionPolicy.usedCredits', '이미 사용한 학점 수가 삭제 총한도를 초과합니다.');
  if (policy.maxCourses != null && (policy.usedCourses ?? 0) > policy.maxCourses) add('deletionPolicy.usedCourses', '이미 사용한 과목 수가 삭제 개수 제한을 초과합니다.');
  policy.allowedGrades?.forEach((grade) => {
    if (!grades.has(grade)) add('deletionPolicy.allowedGrades', `삭제 허용 등급 ${grade}이 환산표에 없습니다.`);
  });
  return issues;
}

function totals(input: ScenarioInput, courses: Course[]): Totals {
  const grades = new Map(input.grades.map((grade) => [grade.label, grade]));
  let C = 0;
  let W = 0;
  let weighted = 0;
  const categoryCredits: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const course of courses) {
    const grade = grades.get(course.grade)!;
    if (grade.earned) {
      C += course.credits;
      categoryCredits[course.categoryId] = (categoryCredits[course.categoryId] ?? 0) + course.credits;
    }
    if (grade.points !== null && !course.transferCredit) {
      W += course.credits;
      weighted += course.credits * scaled(grade.points);
    }
  }
  const ratio = W === 0 ? null : { numerator: weighted, denominator: W * SCALE };
  return { C, W, S: weighted / SCALE, gpa: ratio ? ratio.numerator / ratio.denominator : null, gpaDisplay: formatGpa(ratio), categoryCredits };
}

function graduation(input: ScenarioInput, courses: Course[], current: Totals, planned: boolean): GraduationResult {
  const rule = input.graduationRule;
  const categories = { ...current.categoryCredits };
  const grades = new Map(input.grades.map((grade) => [grade.label, grade]));
  const codes = new Set(courses.filter((course) => grades.get(course.grade)!.earned).map((course) => course.courseCode).filter(hasText));
  let earned = current.C;
  if (planned) {
    for (const course of input.semesters.flatMap((semester) => semester.courses)) {
      earned += course.credits;
      categories[course.categoryId] = (categories[course.categoryId] ?? 0) + course.credits;
      if (hasText(course.courseCode)) codes.add(course.courseCode);
    }
  }
  const requirement = (id: string, label: string, required: number, credits: number): CreditRequirementResult =>
    ({ id, label, required, earned: credits, missing: Math.max(0, required - credits) });
  const total = rule.totalCredits === null ? null : requirement('total', '총 졸업 이수 학점 수', rule.totalCredits, earned);
  const areas = rule.areas.map((area) => requirement(area.id, area.label, area.minCredits,
    [...new Set(area.categoryIds)].reduce((sum, id) => sum + (categories[id] ?? 0), 0)));
  const missingRequiredCourses = rule.requiredCourses.map((course) => {
    const completedCount = [...new Set(course.alternatives)].filter((code) => codes.has(code)).length;
    return { ...course, completedCount, missingCount: Math.max(0, (course.minimumCount ?? 1) - completedCount) };
  }).filter((course) => course.missingCount > 0);
  const categoryDiversity = (rule.categoryDiversity ?? []).map((group) => {
    const completedCount = [...new Set(group.categoryIds)].filter((id) => (categories[id] ?? 0) >= (group.minCreditsPerCategory ?? 1)).length;
    return { id: group.id, label: group.label, requiredCount: group.minCount, completedCount, missingCount: Math.max(0, group.minCount - completedCount) };
  });
  const unknownReasons = [...rule.unknownReasons];
  if (rule.totalCredits === null) unknownReasons.push('총 졸업 이수 학점 수를 확인해야 합니다.');
  const nonCreditRequirements = rule.nonCreditRequirements ?? [];
  const creditRequirementsSatisfied = total !== null && total.missing === 0 && areas.every((area) => area.missing === 0) && missingRequiredCourses.length === 0 && categoryDiversity.every((group) => group.missingCount === 0);
  return {
    status: unknownReasons.length > 0 || nonCreditRequirements.length > 0 ? 'unverified' : creditRequirementsSatisfied ? 'satisfied' : 'insufficient',
    creditRequirementsSatisfied, total, areas, categoryDiversity, missingRequiredCourses, unknownReasons, nonCreditRequirements, conditional: planned,
  };
}

function goal(input: ScenarioInput, current: Totals): GoalResult {
  const gradePoints = input.grades.flatMap((grade) => grade.points === null ? [] : [scaled(grade.points)]);
  const minimum = gradePoints.length ? Math.min(...gradePoints) : 0;
  const maximum = gradePoints.length ? Math.max(...gradePoints) : 0;
  let futureCredits = 0;
  let futureGradedCredits = 0;
  let freeGradedCredits = 0;
  let fixedContribution = 0;
  const semesterRows = input.semesters.map((semester) => {
    const credits = semester.courses.reduce((sum, course) => sum + course.credits, 0);
    const gradedCredits = semester.courses.reduce((sum, course) => sum + (course.graded ? course.credits : 0), 0);
    futureCredits += credits;
    futureGradedCredits += gradedCredits;
    if (semester.fixedTarget === null) freeGradedCredits += gradedCredits;
    else fixedContribution += scaled(semester.fixedTarget) * gradedCredits;
    return { id: semester.id, label: semester.label, credits, gradedCredits, fixed: semester.fixedTarget !== null, fixedTarget: semester.fixedTarget };
  });
  const denominator = current.W + futureGradedCredits;
  const weighted = scaled(current.S);
  const baseContribution = weighted + fixedContribution;
  const targetScaled = input.targetGpa === null ? null : scaled(input.targetGpa);
  const requiredNumerator = targetScaled === null ? null : targetScaled * denominator - baseContribution;
  const requiredAverageExact = freeGradedCredits > 0 && requiredNumerator !== null ? { numerator: requiredNumerator, denominator: freeGradedCredits * SCALE } : null;
  const requiredAverage = requiredAverageExact ? requiredAverageExact.numerator / requiredAverageExact.denominator : null;
  const minNumerator = baseContribution + minimum * freeGradedCredits;
  const maxNumerator = baseContribution + maximum * freeGradedCredits;
  const minGpa = denominator > 0 ? minNumerator / (denominator * SCALE) : null;
  const maxGpa = denominator > 0 ? maxNumerator / (denominator * SCALE) : null;
  let status: GoalResult['status'];
  let reason: string;
  if (targetScaled === null) {
    status = 'no-target'; reason = '목표 최종 평균평점을 입력하면 필요한 성적을 계산합니다.';
  } else if (denominator === 0) {
    status = 'no-gpa'; reason = '현재 기록과 미래 계획에 평점 산정 대상이 없습니다.';
  } else if (freeGradedCredits === 0) {
    status = baseContribution >= targetScaled * denominator ? 'met' : 'not-met';
    reason = futureGradedCredits === 0 ? '미래 평점 과목이 없어 현재 누적 평균평점으로 목표를 판정합니다.' : '모든 학기의 목표가 고정되어 예상 최종 평균평점으로 판정합니다.';
  } else if (requiredNumerator! > maximum * freeGradedCredits) {
    status = 'impossible'; reason = '필요 평균평점이 환산표 최고값을 초과하여 현재 계획으로 달성할 수 없습니다.';
  } else if (requiredNumerator! <= minimum * freeGradedCredits) {
    status = 'already-secured'; reason = '현재 계획의 최저 성적 가정에서도 성적 목표를 충족합니다. 졸업 요건은 별도로 확인해야 합니다.';
  } else {
    status = 'possible'; reason = '미고정 학기에 같은 필요 평균평점을 적용했습니다. 실제 과목별 등급 조합의 실현 가능성은 별도입니다.';
  }
  // Only attainable suggested plans produce a projection. An impossible required
  // average is preserved as-is, never silently clipped to the grade maximum.
  let projectedNumerator: number | null = null;
  if (denominator > 0 && freeGradedCredits === 0) projectedNumerator = baseContribution;
  else if (denominator > 0 && status === 'possible') projectedNumerator = targetScaled! * denominator;
  else if (denominator > 0 && status === 'already-secured') projectedNumerator = minNumerator;
  const projectedRatio = projectedNumerator === null ? null : { numerator: projectedNumerator, denominator: denominator * SCALE };
  return {
    status, reason, target: input.targetGpa, futureCredits, futureGradedCredits, freeGradedCredits,
    requiredAverage, requiredAverageExact, requiredAverageDisplay: formatRequiredAverage(requiredAverageExact),
    projectedGpa: projectedRatio ? projectedRatio.numerator / projectedRatio.denominator : null,
    projectedGpaDisplay: formatGpa(projectedRatio), minGpa, maxGpa,
    semesters: semesterRows.map((semester) => {
      const target = semester.gradedCredits === 0 ? null : semester.fixed ? semester.fixedTarget : requiredAverage;
      return { id: semester.id, label: semester.label, credits: semester.credits, gradedCredits: semester.gradedCredits, fixed: semester.fixed, target,
        targetDisplay: semester.gradedCredits === 0 ? '평점 미반영 학기' : semester.fixed ? formatGpa(semester.fixedTarget) : formatRequiredAverage(requiredAverageExact) };
    }),
  };
}

function getEligibility(input: ScenarioInput, course: Course): CourseEligibilityResult {
  const policy = input.deletionPolicy;
  const grade = input.grades.find((entry) => entry.label === course.grade)!;
  const reasons: string[] = [];
  let status = course.deletionEligibility;
  if (status !== 'eligible') reasons.push(course.deletionReason || (status === 'ineligible' ? '삭제 대상이 아닌 과목입니다.' : '삭제 자격을 확인해야 합니다.'));
  if (policy.allowedGrades && !policy.allowedGrades.includes(course.grade)) {
    status = 'ineligible'; reasons.push('규정상 삭제할 수 없는 등급입니다.');
  }
  if (course.transferCredit && policy.allowTransferCredits !== true) {
    if (policy.allowTransferCredits === false) {
      status = 'ineligible'; reasons.push('편입 인정 과목은 삭제할 수 없습니다.');
    } else if (status !== 'ineligible') {
      status = 'unknown'; reasons.push('편입 인정 과목의 삭제 규칙을 확인해야 합니다.');
    }
  }
  if (policy.blockedReasons?.length) {
    status = 'ineligible'; reasons.push(...policy.blockedReasons);
  }
  if ((!policy.confirmed || policy.unknownReasons?.length) && status !== 'ineligible') {
    status = 'unknown'; reasons.push(...(policy.unknownReasons?.length ? policy.unknownReasons : ['삭제 규칙이 확정되지 않았습니다.']));
  }
  return { courseId: course.id, status, reasons: [...new Set(reasons)], chargeCredits: grade.earned ? course.credits : 0 };
}

/** Exact 0/1 subset search: for each credit sum, a lower course count dominates. */
function maximumCombination(candidates: CourseEligibilityResult[], cap: number, maxCount: number): { credits: number; ids: string[]; count: number } {
  const possible = candidates.filter((candidate) => candidate.chargeCredits <= cap);
  let count = 0;
  let countCost = 0;
  for (const candidate of [...possible].sort((a, b) => a.chargeCredits - b.chargeCredits)) {
    if (count === maxCount || countCost + candidate.chargeCredits > cap) break;
    countCost += candidate.chargeCredits; count += 1;
  }
  if (count === 0) return { credits: 0, ids: [], count: 0 };
  const fullCost = possible.reduce((sum, candidate) => sum + candidate.chargeCredits, 0);
  if (possible.length <= maxCount && fullCost <= cap) return { credits: fullCost, ids: possible.map((candidate) => candidate.courseId), count };
  const states = new Map<number, string[]>([[0, []]]);
  for (const candidate of possible) {
    if (candidate.chargeCredits === 0) continue;
    for (const [cost, ids] of [...states]) {
      const next = cost + candidate.chargeCredits;
      if (next > cap || ids.length >= maxCount) continue;
      const previous = states.get(next);
      if (!previous || previous.length > ids.length + 1) states.set(next, [...ids, candidate.courseId]);
    }
  }
  let best = 0;
  for (const cost of states.keys()) best = Math.max(best, cost);
  const ids = [...states.get(best)!];
  for (const candidate of possible) {
    if (candidate.chargeCredits === 0 && ids.length < maxCount) ids.push(candidate.courseId);
  }
  return { credits: best, ids, count };
}

function deletion(input: ScenarioInput, original: Totals): DeletionResult {
  const policy = input.deletionPolicy;
  const selected = new Set(input.selectedCourseIds);
  const eligibility = input.courses.map((course) => getEligibility(input, course));
  const chosen = eligibility.filter((entry) => selected.has(entry.courseId));
  const selectedChargeCredits = chosen.reduce((sum, entry) => sum + entry.chargeCredits, 0);
  const selectedCourseCredits = input.courses.filter((course) => selected.has(course.id)).reduce((sum, course) => sum + course.credits, 0);
  const remainingCreditLimit = policy.creditLimit === null ? null : policy.creditLimit - policy.usedCredits - selectedChargeCredits;
  const remainingCourseLimit = policy.maxCourses == null ? null : policy.maxCourses - (policy.usedCourses ?? 0) - chosen.length;
  const reasons: string[] = [];
  let assumed = false;
  for (const entry of chosen) {
    if (entry.status === 'ineligible' || (entry.status === 'unknown' && !input.assumeUnknownDeletionEligibility)) reasons.push(...entry.reasons);
    if (entry.status === 'unknown' && input.assumeUnknownDeletionEligibility) assumed = true;
  }
  if (remainingCreditLimit !== null && remainingCreditLimit < 0) reasons.push('선택한 과목의 소진 학점 수가 남은 삭제 한도를 초과합니다.');
  if (remainingCourseLimit !== null && remainingCourseLimit < 0) reasons.push('선택한 과목 수가 남은 삭제 개수 제한을 초과합니다.');
  if (chosen.length > 0 && policy.earnedCreditFloor != null && original.C - selectedChargeCredits < policy.earnedCreditFloor) reasons.push('삭제 후 현재 이수 학점 수가 규정상 유지해야 하는 수료 학점 수보다 적습니다.');
  const applied = reasons.length === 0;
  const ruleConfirmed = policy.confirmed && !policy.unknownReasons?.length;
  let candidateState: DeletionResult['candidateState'] = 'unverified';
  let additionalMaxCredits: number | null = null;
  let additionalMaxCourseIds: string[] = [];
  let additionalSelectableCourseCount: number | null = null;
  if (!applied) candidateState = 'blocked';
  else if (ruleConfirmed && !assumed) {
    const candidates = eligibility.filter((entry) => entry.status === 'eligible' && !selected.has(entry.courseId));
    const floorCap = policy.earnedCreditFloor == null ? Infinity : Math.max(0, original.C - selectedChargeCredits - policy.earnedCreditFloor);
    const cap = Math.min(remainingCreditLimit ?? Infinity, floorCap);
    const best = maximumCombination(candidates, cap, remainingCourseLimit ?? candidates.length);
    additionalMaxCredits = best.credits;
    additionalMaxCourseIds = best.ids;
    additionalSelectableCourseCount = best.count;
    candidateState = candidates.length === 0 ? 'no-candidates' : best.count === 0 ? 'no-combination' : 'available';
  }
  return { applied, assumed, reasons: [...new Set(reasons)], selectedCourseIds: [...input.selectedCourseIds], selectedCourseCredits, selectedChargeCredits,
    usedCredits: policy.usedCredits, remainingCreditLimit, remainingCourseLimit, additionalMaxCredits, additionalMaxCourseIds, additionalSelectableCourseCount, candidateState, eligibility };
}

function snapshot(input: ScenarioInput, courses: Course[]): ScenarioSnapshot {
  const current = totals(input, courses);
  return { totals: current, currentGraduation: graduation(input, courses, current, false), plannedGraduation: graduation(input, courses, current, true), goal: goal(input, current) };
}

export function calculateScenario(input: ScenarioInput): ScenarioResult {
  const issues = validateScenario(input);
  if (issues.length > 0) return { valid: false, issues };
  const before = snapshot(input, input.courses);
  const selection = deletion(input, before.totals);
  const selected = new Set(input.selectedCourseIds);
  const after = selection.applied && selected.size > 0 ? snapshot(input, input.courses.filter((course) => !selected.has(course.id))) : before;
  const warnings = [
    '계획 반영 졸업 요건은 계획 과목을 모두 이수하여 인정받는다는 가정입니다.',
    '예상 누적 평균평점 범위는 졸업 가능한 성적 범위와 다릅니다. 최저 성적의 F는 이수 학점으로 인정되지 않을 수 있습니다.',
    '재수강·중복 인정은 자동 처리하지 않습니다. 실제 반영되는 최종 이수 기록을 입력해 주세요.',
  ];
  if (selection.assumed) warnings.push('자격 확인 전 가정: 확인되지 않은 삭제 자격을 허용한 비교입니다.');
  if (!input.deletionPolicy.confirmed || input.deletionPolicy.unknownReasons?.length) warnings.push('삭제 규칙 미확정: 남은 삭제 한도는 참고값이며 확정 최대값을 제공하지 않습니다.');
  return { valid: true, issues: [], before, after, deletion: selection, warnings };
}
