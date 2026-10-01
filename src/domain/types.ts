/** School rules are supplied by the caller; the engine has no built-in school defaults. */
export interface GradeDefinition {
  label: string;
  points: number | null;
  earned: boolean;
}

export type DeletionEligibility = 'eligible' | 'ineligible' | 'unknown';

export interface Course {
  id: string;
  courseCode?: string;
  name: string;
  semester: string;
  categoryId: string;
  credits: number;
  grade: string;
  deletionEligibility: DeletionEligibility;
  deletionReason?: string;
  transferCredit?: boolean;
}

export interface PlannedCourse {
  id: string;
  courseCode?: string;
  name: string;
  categoryId: string;
  credits: number;
  graded: boolean;
}

export interface Semester {
  id: string;
  label: string;
  fixedTarget: number | null;
  courses: PlannedCourse[];
}

export interface GraduationArea {
  id: string;
  label: string;
  minCredits: number;
  /** Union of course categories, e.g. required and elective courses in one major. */
  categoryIds: string[];
}

export interface RequiredCourse {
  id: string;
  label: string;
  /** Completing any one of these codes satisfies this requirement. */
  alternatives: string[];
  /** Distinct course codes required from the alternatives. Defaults to one. */
  minimumCount?: number;
}

export interface GraduationRule {
  totalCredits: number | null;
  areas: GraduationArea[];
  requiredCourses: RequiredCourse[];
  categoryDiversity?: {
    id: string;
    label: string;
    categoryIds: string[];
    minCount: number;
    /** A category counts once it has at least this many credits. Defaults to one. */
    minCreditsPerCategory?: number;
  }[];
  unknownReasons: string[];
  /** Exams, certifications and other conditions not established by credit arithmetic. */
  nonCreditRequirements?: string[];
}

export interface DeletionPolicy {
  /** null means unlimited only when confirmed is true. */
  creditLimit: number | null;
  usedCredits: number;
  confirmed: boolean;
  maxCourses?: number | null;
  usedCourses?: number;
  /** Minimum already-earned credits that must remain after deletion, not future credits. */
  earnedCreditFloor?: number | null;
  allowedGrades?: string[];
  allowTransferCredits?: boolean;
  /** Known reasons that make the applicant ineligible, such as an unmet semester condition. */
  blockedReasons?: string[];
  unknownReasons?: string[];
}

export interface ScenarioInput {
  grades: GradeDefinition[];
  courses: Course[];
  semesters: Semester[];
  graduationRule: GraduationRule;
  deletionPolicy: DeletionPolicy;
  selectedCourseIds: string[];
  targetGpa: number | null;
  assumeUnknownDeletionEligibility?: boolean;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ExactRatio {
  numerator: number;
  denominator: number;
}

export interface Totals {
  /** Graduation credits, GPA credits, and unrounded weighted grade points. */
  C: number;
  W: number;
  S: number;
  gpa: number | null;
  gpaDisplay: string;
  categoryCredits: Record<string, number>;
}

export interface CreditRequirementResult {
  id: string;
  label: string;
  required: number;
  earned: number;
  missing: number;
}

export interface GraduationResult {
  status: 'satisfied' | 'insufficient' | 'unverified';
  creditRequirementsSatisfied: boolean;
  total: CreditRequirementResult | null;
  areas: CreditRequirementResult[];
  categoryDiversity: { id: string; label: string; requiredCount: number; completedCount: number; missingCount: number }[];
  missingRequiredCourses: (RequiredCourse & { completedCount: number; missingCount: number })[];
  unknownReasons: string[];
  nonCreditRequirements: string[];
  conditional: boolean;
}

export type GoalStatus =
  | 'no-target'
  | 'no-gpa'
  | 'impossible'
  | 'already-secured'
  | 'possible'
  | 'met'
  | 'not-met';

export interface SemesterResult {
  id: string;
  label: string;
  credits: number;
  gradedCredits: number;
  fixed: boolean;
  target: number | null;
  targetDisplay: string;
}

export interface GoalResult {
  status: GoalStatus;
  reason: string;
  target: number | null;
  futureCredits: number;
  futureGradedCredits: number;
  freeGradedCredits: number;
  requiredAverage: number | null;
  requiredAverageExact: ExactRatio | null;
  requiredAverageDisplay: string;
  projectedGpa: number | null;
  projectedGpaDisplay: string;
  minGpa: number | null;
  maxGpa: number | null;
  semesters: SemesterResult[];
}

export interface ScenarioSnapshot {
  totals: Totals;
  currentGraduation: GraduationResult;
  plannedGraduation: GraduationResult;
  goal: GoalResult;
}

export interface CourseEligibilityResult {
  courseId: string;
  status: DeletionEligibility;
  reasons: string[];
  /** F/NP contribute zero to this credit-based limit if the supplied grade awards no credits. */
  chargeCredits: number;
}

export interface DeletionResult {
  applied: boolean;
  assumed: boolean;
  reasons: string[];
  selectedCourseIds: string[];
  selectedCourseCredits: number;
  selectedChargeCredits: number;
  usedCredits: number;
  remainingCreditLimit: number | null;
  remainingCourseLimit: number | null;
  /** null means the governing rule/selection is not confirmed, not zero selectable credits. */
  additionalMaxCredits: number | null;
  additionalMaxCourseIds: string[];
  additionalSelectableCourseCount: number | null;
  candidateState: 'available' | 'no-candidates' | 'no-combination' | 'unverified' | 'blocked';
  eligibility: CourseEligibilityResult[];
}

export type ScenarioResult =
  | { valid: false; issues: ValidationIssue[] }
  | {
      valid: true;
      issues: [];
      before: ScenarioSnapshot;
      after: ScenarioSnapshot;
      deletion: DeletionResult;
      warnings: string[];
    };
