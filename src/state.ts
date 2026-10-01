import type { StudentAcademic } from './data/academic';
import type { Course, Semester } from './domain/types';
import { isPersonalRequirements, type PersonalRequirements } from './domain/personal';

export const STORAGE_KEY = 'hakjeo-mojeomo:v1';
/** Read old records during the service rename; only the new key is used for new saves. */
export const LEGACY_STORAGE_KEY = 'hakjeo-mujeomu:v1';
export const RULE_VERSION = 'kku-2020-2026-checked-2026-10-02';

export interface AppState {
  version: 1;
  ruleVersion: string;
  academic: StudentAcademic;
  applicationTerm: string;
  courses: Course[];
  semesters: Semester[];
  selectedCourseIds: string[];
  targetGpa: number | null;
  saveEnabled: boolean;
  demo: boolean;
  confirmedChecks: string[];
  personalRequirements?: PersonalRequirements;
}

export function emptyState(academic: StudentAcademic): AppState {
  return { version: 1, ruleVersion: RULE_VERSION, academic, applicationTerm: '2026-2', courses: [], semesters: [], selectedCourseIds: [], targetGpa: null, saveEnabled: true, demo: false, confirmedChecks: [] };
}

export function defaultAcademic(entryYear: number): StudentAcademic {
  return { entryYear, admissionType: 'freshman', registeredSemesters: null, enrollmentStatus: 'unknown', primaryDepartmentId: 'computer', secondaryDepartmentId: null, secondarySelectionYear: null, deletionRound: 'first', baselineEarnedCredits: null, priorPendingDeletionCredits: 0 };
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function nullableNumber(value: unknown) { return value === null || finite(value); }
function optionalNumber(value: unknown) { return value === undefined || nullableNumber(value); }
function nullableTarget(value: unknown) {
  return value === null || (finite(value) && value >= 0 && value <= 4.5
    && Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-8);
}
function texts(value: unknown): value is string[] { return Array.isArray(value) && value.length <= 2000 && value.every(item => typeof item === 'string'); }
function courseShape(value: unknown, planned = false): boolean {
  if (!record(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.categoryId !== 'string' || !finite(value.credits)) return false;
  if (value.courseCode !== undefined && typeof value.courseCode !== 'string') return false;
  if (planned) return typeof value.graded === 'boolean';
  return typeof value.semester === 'string' && typeof value.grade === 'string' && ['eligible', 'ineligible', 'unknown'].includes(String(value.deletionEligibility)) && (value.transferCredit === undefined || typeof value.transferCredit === 'boolean') && (value.deletionReason === undefined || typeof value.deletionReason === 'string');
}

/** Validate persisted shape before use; calculation validation separately checks semantics. */
export function parseSavedState(raw: string): AppState {
  if (raw.length > 5_000_000) throw new Error('저장 데이터가 너무 큽니다.');
  const value: unknown = JSON.parse(raw);
  if (!record(value) || value.version !== 1 || !record(value.academic)) throw new Error('지원하지 않는 저장 형식입니다.');
  const academic = value.academic;
  const academicValid = finite(academic.entryYear) && academic.entryYear >= 2020 && academic.entryYear <= 2026 && Number.isInteger(academic.entryYear)
    && ['freshman', 'transfer', 'major-change'].includes(String(academic.admissionType))
    && ['enrolled', 'leave', 'unknown'].includes(String(academic.enrollmentStatus))
    && ['first', 'second'].includes(String(academic.deletionRound))
    && typeof academic.primaryDepartmentId === 'string' && (academic.secondaryDepartmentId === null || typeof academic.secondaryDepartmentId === 'string')
    && ['registeredSemesters', 'secondarySelectionYear', 'baselineEarnedCredits'].every(key => nullableNumber(academic[key]))
    && ['curriculumYear', 'transferAdmissionYear', 'transferEntryGrade'].every(key => optionalNumber(academic[key]))
    && finite(academic.priorPendingDeletionCredits);
  const provenanceValid = (academic.registeredSemestersEstimated === undefined || typeof academic.registeredSemestersEstimated === 'boolean')
    && ['registrationSourceNote', 'baselineSourceNote'].every(key => academic[key] === undefined || (typeof academic[key] === 'string' && academic[key].length <= 2000));
  if (!academicValid || !provenanceValid || typeof value.applicationTerm !== 'string' || !/^\d{4}-(1|2)$/.test(value.applicationTerm)) throw new Error('학적 정보의 저장 형식이 올바르지 않습니다.');
  if (!Array.isArray(value.courses) || value.courses.length > 2000 || !value.courses.every(item => courseShape(item))) throw new Error('과목 데이터가 올바르지 않습니다.');
  if (!Array.isArray(value.semesters) || value.semesters.length > 30 || !value.semesters.every(item => record(item) && typeof item.id === 'string' && typeof item.label === 'string' && nullableTarget(item.fixedTarget) && Array.isArray(item.courses) && item.courses.length <= 2000 && item.courses.every(course => courseShape(course, true)))) throw new Error('학기 계획의 저장 형식이 올바르지 않습니다.');
  if (!texts(value.selectedCourseIds) || !texts(value.confirmedChecks) || !nullableTarget(value.targetGpa) || typeof value.saveEnabled !== 'boolean' || typeof value.demo !== 'boolean' || typeof value.ruleVersion !== 'string') throw new Error('시뮬레이션의 저장 형식이 올바르지 않습니다.');
  if (value.personalRequirements !== undefined && !isPersonalRequirements(value.personalRequirements)) throw new Error('개인별 확인 요건의 저장 형식이 올바르지 않습니다.');
  return value as unknown as AppState;
}

export function loadState(): { state: AppState | null; error: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    return { state: raw ? parseSavedState(raw) : null, error: null };
  } catch {
    return { state: null, error: '저장 데이터를 복원하지 못했습니다. 기존 저장본은 유지했습니다. 새로 시작하거나 백업 파일을 사용해 주세요.' };
  }
}
