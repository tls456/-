import type { BuiltProfile } from './buildProfile';
import type { PlannedCourse, ScenarioSnapshot } from './types';

/** Remaining requirements overlap: never sum them to derive total remaining credits. */
export function remainingRequirements(snapshot: ScenarioSnapshot, profile: BuiltProfile, plannedCourses: readonly PlannedCourse[] = []) {
  const rules = profile.graduationRule;
  const names = new Map(profile.categories.map(category => [category.id, category.label]));
  const credits = { ...snapshot.totals.categoryCredits };
  for (const course of plannedCourses) credits[course.categoryId] = (credits[course.categoryId] ?? 0) + course.credits;
  const areas = snapshot.currentGraduation.areas.filter(area => area.missing > 0).map(area => {
    const definition = rules.areas.find(rule => rule.id === area.id);
    const aggregate = !!definition && rules.areas.some(other => other.id !== definition.id
      && other.categoryIds.length < definition.categoryIds.length
      && other.categoryIds.every(id => definition.categoryIds.includes(id)));
    return { ...area, aggregate };
  });
  const diversity = snapshot.currentGraduation.categoryDiversity.filter(group => group.missingCount > 0).map(group => {
    const rule = rules.categoryDiversity?.find(item => item.id === group.id);
    const minimum = rule?.minCreditsPerCategory ?? 1;
    return { ...group, minimum, choices: (rule?.categoryIds ?? [])
      .filter(id => (credits[id] ?? 0) < minimum)
      .map(id => ({ id, label: names.get(id) ?? id, missing: minimum - (credits[id] ?? 0) })) };
  });
  return { areas: areas.filter(area => !area.aggregate), aggregates: areas.filter(area => area.aggregate), diversity };
}
