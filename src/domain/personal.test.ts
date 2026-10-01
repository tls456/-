import { describe, expect, it } from 'vitest';
import { applyPersonalRequirements, getPersonalContextKey, isPersonalRequirements, validatePersonalRequirements, type PersonalRequirements } from './personal';
import { buildProfile } from './buildProfile';
import { defaultAcademic } from '../state';

const academic = defaultAcademic(2025);
const profile = buildProfile(academic);
function personal(overrides: Partial<PersonalRequirements> = {}): PersonalRequirements {
  return { contextKey: getPersonalContextKey(academic), sourceNote: '학과에서 확인한 취득학점확인원', checkedAt: '2026-10-02', requiredCourses: [], areas: [], exemptRequirementIds: [], confirmedUnknownReasons: [], confirmedNonCreditRequirements: [], ...overrides };
}

describe('개인별 확인 요건', () => {
  it('개인자료가 없으면 원래 프로필을 유지한다', () => {
    expect(applyPersonalRequirements(profile, academic)).toBe(profile);
  });
  it('필수과목·선택필수·추가영역을 추가하되 원본을 수정하지 않는다', () => {
    const input = personal({ requiredCourses: [{ id: 'personal-course-one', label: '학과확인 선택필수', alternatives: ['A', 'B', 'C'], minimumCount: 2 }], areas: [{ id: 'personal-area-one', label: '개인 지정전공', categoryIds: ['primary-required', 'primary-elective'], minCredits: 12 }] });
    const before = JSON.stringify(profile);
    const result = applyPersonalRequirements(profile, academic, input);
    expect(result.graduationRule.requiredCourses.at(-1)?.minimumCount).toBe(2);
    expect(result.graduationRule.areas.at(-1)?.minCredits).toBe(12);
    expect(JSON.stringify(profile)).toBe(before);
    expect(result.sources).toEqual(profile.sources);
    expect(result.notices.some((notice) => notice.includes('사용자 입력'))).toBe(true);
  });
  it('기존 영역 변경은 학점만 변경하고 영역 의미와 표시는 보존한다', () => {
    const original = profile.graduationRule.areas[0];
    const input = personal({ areas: [{ ...original, label: '사용자 새 이름', categoryIds: ['general-free'], minCredits: 40 }] });
    const result = applyPersonalRequirements(profile, academic, input);
    expect(result.graduationRule.areas[0]).toEqual({ ...original, minCredits: 40 });
  });
  it('확인된 면제만 제거하고 총졸업학점과 다른조건은 남긴다', () => {
    const area = profile.graduationRule.areas[0];
    const course = profile.graduationRule.requiredCourses[0];
    const result = applyPersonalRequirements(profile, academic, personal({ exemptRequirementIds: [area.id, course.id] }));
    expect(result.graduationRule.areas.some((item) => item.id === area.id)).toBe(false);
    expect(result.graduationRule.requiredCourses.some((item) => item.id === course.id)).toBe(false);
    expect(result.graduationRule.totalCredits).toBe(profile.graduationRule.totalCredits);
  });
  it('미확정사항과 비학점사항은 원문일치하는 사용자확인만 제거한다', () => {
    const uncertain = { ...profile, graduationRule: { ...profile.graduationRule, unknownReasons: ['확인A', '확인B'], nonCreditRequirements: ['논문', '인증'] } };
    const result = applyPersonalRequirements(uncertain, academic, personal({ confirmedUnknownReasons: ['확인A'], confirmedNonCreditRequirements: ['논문'] }));
    expect(result.graduationRule.unknownReasons).toEqual(['확인B']);
    expect(result.graduationRule.nonCreditRequirements).toEqual(['인증']);
  });
  it('교육과정 변경시 저장된조건을 보존하되 하나도 적용하지 않는다', () => {
    const input = personal({ exemptRequirementIds: [profile.graduationRule.requiredCourses[0].id] });
    const before = JSON.stringify(input);
    const changed = { ...academic, curriculumYear: 2024 };
    const result = applyPersonalRequirements(profile, changed, input);
    expect(result.graduationRule.requiredCourses).toEqual(profile.graduationRule.requiredCourses);
    expect(result.graduationRule.unknownReasons.some((reason) => reason.includes('미적용'))).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
  });
  it('입학·학적·편입·전공 구성은 문맥에 포함하고 삭제설정은 제외한다', () => {
    const base = getPersonalContextKey(academic);
    expect(getPersonalContextKey({ ...academic, registeredSemesters: 8, deletionRound: 'second', baselineEarnedCredits: 132 })).toBe(base);
    for (const patch of [{ entryYear: 2024 }, { admissionType: 'transfer' as const }, { curriculumYear: 2024 }, { transferAdmissionYear: 2026 }, { transferEntryGrade: 3 as const }, { primaryDepartmentId: '경영학과' }, { secondaryDepartmentId: '경영학과' }, { secondarySelectionYear: 2026 }]) {
      expect(getPersonalContextKey({ ...academic, ...patch })).not.toBe(base);
    }
  });
  it.each([
    { sourceNote: ' ' }, { checkedAt: '' }, { checkedAt: '2026-02-30' },
    { areas: [{ id: 'personal-area-one', label: '영역', categoryIds: ['primary-required'], minCredits: 1.5 }] },
    { requiredCourses: [{ id: 'personal-course-one', label: '필수', alternatives: ['A'], minimumCount: 2 }] },
    { requiredCourses: [{ id: 'personal-course-one', label: '필수', alternatives: ['A', 'A'] }] },
  ])('잘못된 입력은 복원검증과 적용을 모두 거부한다: %j', (patch) => {
    const input = personal(patch);
    expect(isPersonalRequirements(input)).toBe(false);
    expect(applyPersonalRequirements(profile, academic, input).graduationRule.areas).toEqual(profile.graduationRule.areas);
  });
  it('존재하지않는 면제·확인과목·영역은 전체 적용을 보류한다', () => {
    for (const patch of [
      { exemptRequirementIds: ['missing-id'] },
      { confirmedUnknownReasons: ['새 규정에서 사라진 옛문장'] },
      { confirmedNonCreditRequirements: ['새 규정에서 사라진 옛문장'] },
      { areas: [{ id: 'personal-area-one', label: '영역', minCredits: 3, categoryIds: ['not-a-category'] }] },
    ]) {
      const input = personal(patch);
      expect(validatePersonalRequirements(profile, academic, input).length).toBeGreaterThan(0);
      expect(applyPersonalRequirements(profile, academic, input).graduationRule.areas).toEqual(profile.graduationRule.areas);
    }
  });
  it('같은조건의 면제와 변경을 동시에 적용하지 않는다', () => {
    const area = profile.graduationRule.areas[0];
    expect(validatePersonalRequirements(profile, academic, personal({ areas: [{ ...area, minCredits: 20 }], exemptRequirementIds: [area.id] })).length).toBeGreaterThan(0);
  });
  it('필수와영역을 같은ID로 기록할 수 없다', () => {
    expect(isPersonalRequirements(personal({ requiredCourses: [{ id: 'duplicate', label: '필수', alternatives: ['A'] }], areas: [{ id: 'duplicate', label: '영역', categoryIds: ['general-free'], minCredits: 3 }] }))).toBe(false);
  });
});
