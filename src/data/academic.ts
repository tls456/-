import type { Course, DeletionEligibility, DeletionPolicy, GradeDefinition } from '../domain/types';

export const ACADEMIC_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;
export type AcademicYear = (typeof ACADEMIC_YEARS)[number];

/** Grade points are unchanged in the inspected 2020–2026 bulletins. */
export const GRADES: GradeDefinition[] = [
  { label: 'A+', points: 4.5, earned: true },
  { label: 'A', points: 4, earned: true },
  { label: 'B+', points: 3.5, earned: true },
  { label: 'B', points: 3, earned: true },
  { label: 'C+', points: 2.5, earned: true },
  { label: 'C', points: 2, earned: true },
  { label: 'D+', points: 1.5, earned: true },
  { label: 'D', points: 1, earned: true },
  { label: 'F', points: 0, earned: false },
  { label: 'P', points: null, earned: true },
  { label: 'N', points: null, earned: false },
];

/** N is the regulation's label; NP is also used by official GLOCAL notices. */
export function normalizeGrade(value: string): string | null {
  const grade = value.trim().toUpperCase();
  if (grade === 'NP') return 'N';
  return GRADES.some((item) => item.label === grade) ? grade : null;
}

export const OFFICIAL_SOURCES = [
  {
    id: 'academic-bylaws',
    title: '건국대학교 학칙시행세칙 Ⅰ',
    url: 'https://rule.konkuk.ac.kr/lmxsrv/law/lawFullContent.do?SEQ=410&SEQ_HISTORY=3648',
    locator: '제2조 제2~4항, 제7조의2 제1~6항',
    revision: '2026-02-26',
    checkedAt: '2026-10-02',
  },
  {
    id: 'academic-rules',
    title: '건국대학교 학칙',
    url: 'https://rule.konkuk.ac.kr/lmxsrv/law/lawFullContent.do?SEQ=409&SEQ_HISTORY=3723',
    locator: '제30조 성적등급 및 평점, 제31조 수료 인정학점',
    revision: '2026-07-14',
    checkedAt: '2026-10-02',
  },
  {
    id: 'glocal-deletion-guide',
    title: '글로컬캠퍼스 취득학점포기 안내',
    url: 'https://www.kku.ac.kr/cms/FR_CON/index.do?CONTENTS_NO=18&MENU_ID=1320&P_TAB_NO=18',
    locator: '대상, 포기 가능 학점 수, 참고 및 유의사항',
    checkedAt: '2026-10-02',
  },
  {
    id: 'glocal-deletion-2026-first',
    title: '2026학년도 1학기 취득학점포기 시행(1차) 안내',
    url: 'https://greentech.kku.ac.kr/cms/FR_CON/BoardView.do?BBS_SEQ=36523&BOARD_SEQ=1&MENU_ID=190&SITE_NO=42',
    locator: '3. 포기가능학점: F/NP는 한도와 무관하게 포기 가능',
    publishedAt: '2026-04-08',
    checkedAt: '2026-10-02',
  },
  {
    id: 'glocal-deletion-2026-second',
    title: '학사지원팀 2026.1학기 취득학점포기 시행(2차) 안내',
    url: 'https://www.kku.ac.kr/cms/FR_CON/BoardView.do?BBS_SEQ=120116&BOARD_SEQ=18&MENU_ID=1740&SITE_NO=2',
    locator: '1~4, 6: 횟수 제한 없음, 편입 인정학점 포기 불가',
    publishedAt: '2026-06-22',
    checkedAt: '2026-10-02',
  },
  {
    id: 'glocal-grade-guide',
    title: '글로컬캠퍼스 성적·시험 안내',
    url: 'https://www.kku.ac.kr/cms/FR_CON/index.do?CONTENTS_NO=9&MENU_ID=1320&P_TAB_NO=9',
    locator: '성적등급 및 평점',
    checkedAt: '2026-10-02',
  },
  {
    id: 'glocal-transfer-guide',
    title: '글로컬캠퍼스 편입학 안내',
    url: 'https://www.kku.ac.kr/cms/FR_CON/index.do?CONTENTS_NO=3&MENU_ID=1320&P_TAB_NO=3',
    locator: '편입학: 전적대 성적은 본교 평점평균에 미반영',
    checkedAt: '2026-10-02',
  },
  {
    id: 'glocal-major-change-guide',
    title: '글로컬캠퍼스 전과 안내',
    url: 'https://www.kku.ac.kr/cms/FR_CON/index.do?CONTENTS_NO=4&MENU_ID=1320&P_TAB_NO=4',
    locator: '학점이수: 전과 후 교육과정 및 이수구분 확인',
    checkedAt: '2026-10-02',
  },
  {
    id: 'glocal-completion-guide',
    title: '글로컬캠퍼스 수료·졸업 안내',
    url: 'https://www.kku.ac.kr/cms/FR_CON/index.do?CONTENTS_NO=5&MENU_ID=1320&P_TAB_NO=5',
    locator: '수료인정학점 표. 학과별 적용 총학점은 해당 연도 요람으로 별도 확인',
    checkedAt: '2026-10-02',
  },
] as const;

export interface StudentAcademic {
  /** Student ID cohort; this is not necessarily the calendar year of transfer. */
  entryYear: number;
  admissionType: 'freshman' | 'transfer' | 'major-change';
  /** Explicitly confirmed curriculum year, including a permitted curriculum change. */
  curriculumYear?: number | null;
  transferAdmissionYear?: number | null;
  transferEntryGrade?: 2 | 3 | 4 | null;
  /** Current registered semester included; include semesters recognized on transfer. */
  registeredSemesters: number | null;
  enrollmentStatus: 'enrolled' | 'leave' | 'unknown';
  primaryDepartmentId: string;
  secondaryDepartmentId: string | null;
  secondarySelectionYear: number | null;
  deletionRound: 'first' | 'second';
  /** First round: through previous semester. Second round: through current semester. */
  baselineEarnedCredits: number | null;
  /** Only requests not yet subtracted from baseline; never subtract historical W twice. */
  priorPendingDeletionCredits: number;
}

export interface CurriculumYearResult {
  year: AcademicYear | null;
  sourceIds: string[];
  unknownReasons: string[];
}

function resolveYear(year: number | null | undefined, missingMessage: string): CurriculumYearResult {
  if (year == null) {
    return { year: null, sourceIds: ['academic-bylaws'], unknownReasons: [missingMessage] };
  }
  if (!ACADEMIC_YEARS.includes(year as AcademicYear)) {
    return {
      year: null,
      sourceIds: ['academic-bylaws'],
      unknownReasons: ['확인된 교육과정은 2020~2026학년도입니다. 적용 연도를 확인해 주세요.'],
    };
  }
  return { year: year as AcademicYear, sourceIds: ['academic-bylaws'], unknownReasons: [] };
}

/** Bylaws I art. 2: transfer uses the cohort of an uninterrupted student in the same year. */
export function getCurriculumYear(profile: StudentAcademic): CurriculumYearResult {
  if (profile.curriculumYear != null) return resolveYear(profile.curriculumYear, '적용 교육과정을 확인해 주세요.');
  if (profile.admissionType === 'freshman') return resolveYear(profile.entryYear, '입학연도를 입력해 주세요.');
  if (profile.admissionType === 'transfer') {
    if (profile.transferAdmissionYear != null && profile.transferEntryGrade != null) {
      return resolveYear(
        profile.transferAdmissionYear - profile.transferEntryGrade + 1,
        '편입생의 적용 교육과정 연도를 확인해 주세요.',
      );
    }
    return resolveYear(null, '편입한 연도와 편입 학년 또는 학교에서 확인한 교육과정 연도가 필요합니다.');
  }
  return resolveYear(null, '전과 후 소속에서 적용하는 교육과정 연도를 확인해 주세요.');
}

/** Additional majors use selection year, not the student's original admission year. */
export function getSecondaryCurriculumYear(profile: StudentAcademic): CurriculumYearResult {
  if (!profile.secondaryDepartmentId) return { year: null, sourceIds: [], unknownReasons: [] };
  return resolveYear(profile.secondarySelectionYear, '다전공 선발연도를 입력해 주세요.');
}

/**
 * Academic rules art. 31. The 124/132/135/140 arrays were cross-checked against the 2020 bulletin
 * PDF pp.178–179, 2021 pp.187–188, 2022 pp.188–189 and 2023 pp.188–189.
 * Index is completed semester count minus one; no proportional interpolation.
 * A department's graduation total must be supplied from its verified curriculum.
 */
export const COMPLETION_CREDIT_TABLES: Readonly<Record<number, readonly number[]>> = {
  120: [15, 30, 45, 60, 75, 90, 105, 120],
  124: [16, 31, 47, 62, 78, 93, 109, 124],
  132: [17, 33, 50, 66, 83, 99, 116, 132],
  135: [18, 35, 53, 70, 86, 100, 118, 135],
  140: [18, 35, 53, 70, 88, 105, 123, 140],
};

export interface CompletionCreditResult {
  credits: number | null;
  sourceIds: string[];
  unknownReasons: string[];
}

export function getCompletionCreditFloor(
  totalGraduationCredits: number | null,
  completedSemesters: number,
): CompletionCreditResult {
  const sourceIds = ['academic-rules', 'glocal-completion-guide'];
  if (!Number.isInteger(completedSemesters) || completedSemesters < 1 || completedSemesters > 8) {
    return { credits: null, sourceIds, unknownReasons: ['해당 학기 수에 적용할 수료인정학점을 별도로 확인해야 합니다.'] };
  }
  const table = totalGraduationCredits == null ? undefined : COMPLETION_CREDIT_TABLES[totalGraduationCredits];
  if (!table) {
    return { credits: null, sourceIds, unknownReasons: ['해당 교육과정의 수료인정학점 표를 확인하지 못했습니다.'] };
  }
  return { credits: table[completedSemesters - 1], sourceIds, unknownReasons: [] };
}

export type DeletionCapRule = 'official-notice' | 'include-registration-cap' | 'unresolved';

/** Explicit user decision on 2026-10-02: apply the current rules and 2026 notice. */
export const CONFIRMED_DELETION_CAP_RULE: DeletionCapRule = 'official-notice';
export const DELETION_RULE_NOTICE =
  '최신 학칙·2026년 학사지원팀 공지의 총 취득학점−수료인정학점 기준을 적용합니다. ' +
  '2024~2026 요람의 수강신청 한도학점 문구와 차이가 있어 학교 확인이 필요합니다.';

export interface DeletionPolicyOptions {
  totalGraduationCredits: number | null;
  semesterCreditCap?: number | null;
  deletionCapRule?: DeletionCapRule;
}

export interface AcademicDeletionPolicy extends DeletionPolicy {
  sourceIds: string[];
  notices: string[];
  referenceSemesters: number | null;
  completionCreditFloor: number | null;
  baselineEarnedCredits: number | null;
}

/**
 * registeredSemesters=7 means first round uses semester 6, second round uses 7.
 * F/N charge zero under the engine's earned=false rule. The authoritative baseline
 * already reflects confirmed past withdrawals; only pending requests use usedCredits.
 */
export function calculateDeletionPolicy(
  profile: StudentAcademic,
  options: DeletionPolicyOptions,
): AcademicDeletionPolicy {
  const unknownReasons: string[] = [];
  const blockedReasons: string[] = [];
  const sources = ['academic-bylaws', 'glocal-deletion-guide', 'glocal-deletion-2026-first', 'glocal-deletion-2026-second'];
  if (profile.enrollmentStatus === 'leave') blockedReasons.push('휴학생은 취득학점포기를 신청할 수 없습니다.');
  else if (profile.enrollmentStatus !== 'enrolled') unknownReasons.push('신청 및 처리 기간의 재학 상태를 확인해 주세요.');

  const semesters = profile.registeredSemesters;
  let referenceSemesters: number | null = null;
  let completionCreditFloor: number | null = null;
  if (semesters == null || !Number.isInteger(semesters) || semesters < 1) {
    unknownReasons.push('현재 학기를 포함한 등록학기 수를 입력해 주세요. 편입 인정학기도 포함합니다.');
  } else {
    if (semesters < 3) blockedReasons.push('3학기 이상 등록한 재학생부터 취득학점포기를 신청할 수 있습니다.');
    referenceSemesters = profile.deletionRound === 'first' ? semesters - 1 : semesters;
    const floor = getCompletionCreditFloor(options.totalGraduationCredits, referenceSemesters);
    completionCreditFloor = floor.credits;
    unknownReasons.push(...floor.unknownReasons);
    sources.push(...floor.sourceIds);
  }

  const baseline = profile.baselineEarnedCredits;
  if (baseline == null || !Number.isInteger(baseline) || baseline < 0) {
    unknownReasons.push('해당 차수 기준의 총 취득학점을 0 이상의 정수로 확인해 주세요. F/N은 제외합니다.');
  }
  const used = profile.priorPendingDeletionCredits;
  if (!Number.isInteger(used) || used < 0) unknownReasons.push('아직 총 취득학점에 반영되지 않은 신청 학점은 0 이상의 정수여야 합니다.');

  let creditLimit = baseline != null && Number.isInteger(baseline) && baseline >= 0 && completionCreditFloor != null
    ? Math.max(0, baseline - completionCreditFloor)
    : null;
  const capRule = options.deletionCapRule ?? CONFIRMED_DELETION_CAP_RULE;
  if (capRule === 'unresolved') {
    unknownReasons.push('요람과 최신 공지의 삭제 상한 문구 차이에 대한 적용 기준을 확인해야 합니다.');
  } else if (capRule === 'include-registration-cap') {
    const cap = options.semesterCreditCap;
    if (cap == null || !Number.isInteger(cap) || cap < 0) {
      unknownReasons.push('수강신청 한도를 함께 적용하려면 확인된 학기별 한도학점이 필요합니다.');
    } else if (creditLimit != null) creditLimit = Math.min(creditLimit, cap);
  }

  return {
    creditLimit,
    usedCredits: Number.isInteger(used) && used >= 0 ? used : 0,
    confirmed: unknownReasons.length === 0,
    maxCourses: null,
    usedCourses: 0,
    // Input alias NP is normalized to N before entering the calculation engine.
    allowedGrades: ['C+', 'C', 'D+', 'D', 'F', 'N'],
    allowTransferCredits: false,
    blockedReasons,
    unknownReasons,
    sourceIds: [...new Set(sources)],
    notices: [DELETION_RULE_NOTICE],
    referenceSemesters,
    completionCreditFloor,
    baselineEarnedCredits: baseline,
  };
}

interface AcademicTerm {
  ordinal: number;
  seasonal: boolean;
}

function parseAcademicTerm(value: string): AcademicTerm | null {
  const match = /^(\d{4})-(1|여름|2|겨울)$/.exec(value.trim());
  if (!match) return null;
  const offsets: Record<string, number> = { '1': 0, '여름': 1, '2': 2, '겨울': 3 };
  return {
    ordinal: Number(match[1]) * 4 + offsets[match[2]],
    seasonal: match[2] === '여름' || match[2] === '겨울',
  };
}

/**
 * Adds period restrictions to the caller's eligibility; it never promotes an
 * unknown or ineligible row. Seasonal-course processing dates are not inferred.
 * Official guide: first round considers previous semesters; second includes the
 * current regular semester after final grades are posted.
 */
export function prepareCoursesForDeletion(
  courses: Course[],
  applicationTerm: string,
  deletionRound: StudentAcademic['deletionRound'],
): Course[] {
  const application = parseAcademicTerm(applicationTerm);
  return courses.map((course) => {
    let status: DeletionEligibility = course.deletionEligibility;
    const reasons = course.deletionReason ? [course.deletionReason] : [];
    const restrict = (restriction: 'unknown' | 'ineligible', reason: string) => {
      if (status !== 'ineligible') status = restriction;
      reasons.push(reason);
    };
    const term = parseAcademicTerm(course.semester);
    if (!application || application.seasonal) {
      restrict('unknown', '신청 기준 학기를 YYYY-1 또는 YYYY-2 형식으로 확인해 주세요.');
    } else if (!term) {
      restrict('unknown', '이수학기를 YYYY-1, YYYY-여름, YYYY-2, YYYY-겨울 형식으로 확인해 주세요.');
    } else if (term.ordinal > application.ordinal) {
      restrict('ineligible', '신청 기준 학기보다 이후의 과목은 이번 차수에 포기할 수 없습니다.');
    } else if (deletionRound === 'first' && term.ordinal === application.ordinal) {
      restrict('ineligible', '1차 취득학점포기는 당해학기 과목을 포함하지 않습니다.');
    } else if (term.seasonal) {
      restrict('unknown', '계절학기 성적의 확정·등재 시점과 이번 차수 포함 여부를 학교에 확인해 주세요.');
    }
    return {
      ...course,
      grade: normalizeGrade(course.grade) ?? course.grade,
      deletionEligibility: status,
      deletionReason: reasons.length ? [...new Set(reasons)].join(' ') : undefined,
    };
  });
}
