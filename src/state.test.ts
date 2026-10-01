import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDemo } from './demo';
import { simulate } from './domain/simulator';
import { getPersonalContextKey } from './domain/personal';
import { defaultAcademic, emptyState, loadState, parseSavedState, RULE_VERSION, STORAGE_KEY } from './state';

afterEach(() => { vi.unstubAllGlobals(); });

function raw(change: (state: Record<string, unknown>) => void): string {
  const value = JSON.parse(JSON.stringify(createDemo())) as Record<string, unknown>;
  change(value);
  return JSON.stringify(value);
}

describe('입력 상태 저장·복원', () => {
  it('개인 기준의 출처·확인일·필수과목·영역을 보존하며 출처 없는 손상 기록을 거부한다', () => {
    const state = createDemo();
    state.personalRequirements = {
      contextKey: getPersonalContextKey(state.academic),
      sourceNote: '가상 저장 검증을 위한 학과 확인 메모', checkedAt: '2026-10-02',
      requiredCourses: [{ id: 'personal-course-internship', label: '개인 확인 실습', alternatives: ['USER-PRACTICE'], minimumCount: 1 }],
      areas: [{ id: 'personal-area-practice', label: '개인 승인 실습 영역', minCredits: 6, categoryIds: ['primary-elective'] }],
      exemptRequirementIds: [], confirmedUnknownReasons: [], confirmedNonCreditRequirements: [],
    };
    const restored = parseSavedState(JSON.stringify(state));
    expect(restored.personalRequirements).toEqual(state.personalRequirements);
    expect(simulate(restored).profile.graduationRule.requiredCourses.some(course => course.id === 'personal-course-internship')).toBe(true);
    expect(simulate(restored).result).toEqual(simulate(state).result);
    const malformed = structuredClone(state);
    malformed.personalRequirements!.sourceNote = '';
    expect(() => parseSavedState(JSON.stringify(malformed))).toThrow('개인별 확인 요건');
  });

  it('목표·과목·학기·고정 성적·선택·개인정책이 JSON 왕복 뒤 같은 결과를 만든다', () => {
    const state = createDemo();
    state.selectedCourseIds = ['demo-failed'];
    state.semesters[0].fixedTarget = 3.75;
    state.confirmedChecks = ['personal-graduation-review'];
    const before = structuredClone(state);
    const restored = parseSavedState(JSON.stringify(state));
    expect(restored).toEqual(state);
    expect(restored).not.toBe(state);
    expect(simulate(restored).result).toEqual(simulate(state).result);
    expect(state).toEqual(before);
    expect(restored).not.toHaveProperty('result');
  });

  it('신규 미확인 정보와 null 목표를 그대로 유지한다', () => {
    const state = emptyState(defaultAcademic(2026));
    const restored = parseSavedState(JSON.stringify(state));
    expect(restored).toEqual(state);
    expect(restored.academic.registeredSemesters).toBeNull();
    expect(restored.targetGpa).toBeNull();
    expect(simulate(restored).result.valid).toBe(true);
  });

  it('이전 규칙 버전을 입력과 함께 복원하고 현재 코드로 재계산한다', () => {
    const state = createDemo();
    state.ruleVersion = 'old-rule-version';
    const restored = parseSavedState(JSON.stringify(state));
    expect(restored.ruleVersion).toBe('old-rule-version');
    expect(restored.ruleVersion).not.toBe(RULE_VERSION);
    expect(simulate(restored).result).toEqual(simulate({ ...state, ruleVersion: RULE_VERSION }).result);
  });

  it.each([
    ['최상위 형식', () => 'null'],
    ['지원하지 않는 버전', () => raw(state => { state.version = 2; })],
    ['대상 범위 밖 입학연도', () => raw(state => { (state.academic as Record<string, unknown>).entryYear = 2019; })],
    ['알 수 없는 학적 유형', () => raw(state => { (state.academic as Record<string, unknown>).admissionType = 'other'; })],
    ['배열 아닌 과목', () => raw(state => { state.courses = {}; })],
    ['문자열 학점 수', () => raw(state => { ((state.courses as Record<string, unknown>[])[0]).credits = '3'; })],
    ['계획 성적 방식 누락', () => raw(state => { delete (((state.semesters as Record<string, unknown>[])[0]).courses as Record<string, unknown>[])[0].graded; })],
    ['형식이 다른 선택 ID', () => raw(state => { state.selectedCourseIds = [1]; })],
    ['문자열 목표', () => raw(state => { state.targetGpa = '3.5'; })],
    ['목표 필드 누락', () => raw(state => { delete state.targetGpa; })],
    ['목표 허용 범위 초과', () => raw(state => { state.targetGpa = 4.6; })],
    ['목표 정밀도 초과', () => raw(state => { state.targetGpa = 3.5001; })],
    ['고정 목표 필드 누락', () => raw(state => { delete (state.semesters as Record<string, unknown>[])[0].fixedTarget; })],
    ['고정 목표 허용 범위 초과', () => raw(state => { (state.semesters as Record<string, unknown>[])[0].fixedTarget = 4.6; })],
    ['고정 목표 정밀도 초과', () => raw(state => { (state.semesters as Record<string, unknown>[])[0].fixedTarget = 3.5001; })],
    ['필수 등록 학기 필드 누락', () => raw(state => { delete (state.academic as Record<string, unknown>).registeredSemesters; })],
    ['필수 취득 학점 필드 누락', () => raw(state => { delete (state.academic as Record<string, unknown>).baselineEarnedCredits; })],
    ['필수 복수전공 선발연도 필드 누락', () => raw(state => { delete (state.academic as Record<string, unknown>).secondarySelectionYear; })],
    ['유한하지 않은 목표', () => JSON.stringify(createDemo()).replace('"targetGpa":3.5', '"targetGpa":1e999')],
    ['신청 학기 형식', () => raw(state => { state.applicationTerm = '2026-여름'; })],
  ])('%s 손상은 복원 전에 거부한다', (_, makeRaw) => {
    expect(() => parseSavedState(makeRaw())).toThrow();
  });

  it('JSON 크기와 배열 크기 제한을 검사한다', () => {
    expect(() => parseSavedState(' '.repeat(5_000_001))).toThrow('너무 큽니다');
    const state = createDemo();
    state.courses = Array.from({ length: 2001 }, (_, index) => ({ ...state.courses[0], id: `course-${index}` }));
    expect(() => parseSavedState(JSON.stringify(state))).toThrow('과목 데이터');
    state.courses = [];
    state.semesters = Array.from({ length: 31 }, (_, index) => ({ id: `semester-${index}`, label: '계획', fixedTarget: null, courses: [] }));
    expect(() => parseSavedState(JSON.stringify(state))).toThrow('학기 계획');
  });

  it('형식상 유효한 중복·음수·소수 학점은 계산 검증이 차단한다', () => {
    const state = createDemo();
    state.courses[0].credits = -1.5;
    state.courses[1].id = state.courses[0].id;
    const restored = parseSavedState(JSON.stringify(state));
    const result = simulate(restored).result;
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.some(issue => issue.path.endsWith('.credits'))).toBe(true);
      expect(result.issues.some(issue => issue.message.includes('중복'))).toBe(true);
    }
  });

  it('숫자 범위를 넘는 유한값은 엔진에서 안전하게 거부한다', () => {
    const state = createDemo();
    state.courses[0].credits = 1e100;
    const restored = parseSavedState(JSON.stringify(state));
    expect(simulate(restored).result.valid).toBe(false);
  });

  it('localStorage의 저장본을 읽되 쓰거나 지우지 않는다', () => {
    const state = createDemo();
    const storage = { getItem: vi.fn(() => JSON.stringify(state)), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    expect(loadState()).toEqual({ state, error: null });
    expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it.each(['malformed', 'unavailable'])('저장본 %s 오류를 보고하고 원본을 제거하지 않는다', failure => {
    const storage = {
      getItem: vi.fn(() => { if (failure === 'unavailable') throw new Error('Storage unavailable'); return '{incomplete'; }),
      setItem: vi.fn(), removeItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', storage);
    const result = loadState();
    expect(result.state).toBeNull();
    expect(result.error).toContain('기존 저장본은 유지');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('저장 기록이 없으면 신규 시작 상태를 돌려준다', () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null) });
    expect(loadState()).toEqual({ state: null, error: null });
  });

  it('복원 후 목표 편집을 막는 손상 목표는 시작 단계에서 거부하고 원본을 보존한다', () => {
    const state = createDemo();
    state.targetGpa = -1;
    const storage = { getItem: vi.fn(() => JSON.stringify(state)), removeItem: vi.fn(), setItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    expect(loadState()).toMatchObject({ state: null });
    expect(loadState().error).not.toBeNull();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('선택적인 편입·교육과정 필드는 없어도 되고 0과 4.5 목표도 복원한다', () => {
    const state = emptyState(defaultAcademic(2020));
    expect(state.academic.curriculumYear).toBeUndefined();
    expect(state.academic.transferAdmissionYear).toBeUndefined();
    for (const target of [0, 3.333, 4.5]) {
      state.targetGpa = target;
      expect(parseSavedState(JSON.stringify(state)).targetGpa).toBe(target);
    }
  });
});
