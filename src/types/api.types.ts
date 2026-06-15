/**
 * API Types
 * Request and response types for API calls
 */

import type {
  Assignment,
  AssignmentAttemptMode,
  Classroom,
  FiveDScores,
  Message,
  Submission,
  TeacherProfile,
  StudentProfile,
} from './models';

// Classroom API Types
export interface ClassroomWithEnrollmentCount extends Classroom {
  _count?: { enrollments: number };
}

/** Counts returned by teacher_preview_classroom_reset / teacher_reset_classroom */
export interface ClassroomResetScopeCounts {
  active_enrollments: number;
  submissions: number;
  module_flow_progress: number;
  section_progress: number;
  memory_and_nuance_rows: number;
  assignments_preserved: number;
}

export interface ClassroomResetResult {
  before: ClassroomResetScopeCounts;
  deleted: {
    submissions: number;
    nuance_events: number;
    module_flow_progress: number;
    section_progress: number;
    section_comments: number;
    enrollments_unenrolled: number;
    assignments_student_target_cleared: number;
  };
  after: ClassroomResetScopeCounts;
}

export interface ClassroomWithTeacher extends Classroom {
  teacher_profiles: TeacherProfile | null;
}

// Assignment API Types
export interface AssignmentWithClassroom extends Assignment {
  classrooms: {
    name: string;
    teacher_id?: string;
    teacher_profiles?: TeacherProfile | null;
  };
  submissions?: Submission[];
}

export interface CreateAssignmentInput {
  classroom_id: string;
  title: string;
  instructions: string;
  type: Assignment['type'];
  due_at: string | null;
  status: Assignment['status'];
  target_dimensions: Assignment['target_dimensions'];
  personalization_flag: boolean;
  enable_ai_feedback?: boolean;
  auto_publish_ai_feedback?: boolean;
  attempt_mode?: AssignmentAttemptMode;
}

export interface UpdateAssignmentInput extends Partial<CreateAssignmentInput> {
  id: string;
  materials?: Assignment['materials'];
  student_facing_task?: Assignment['student_facing_task'];
  hard_skills?: Assignment['hard_skills'];
  hard_skill_domain?: Assignment['hard_skill_domain'];
}

// Submission API Types
export interface SubmissionWithDetails extends Submission {
  assignments: {
    title: string;
  };
  student_profiles: StudentProfile | null;
  assignment_feedback: Array<{
    student_feedback: string;
    teacher_feedback: string | null;
    created_at: string;
  }>;
}

// Chat API Types
export interface ChatDebugPayload {
  rawModelText: string;
  afterPostprocess: string;
  finalClientMessage: string;
  polishEnabled: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
}

export type InitialGreetingMode = 'default' | 'explain_task';

export interface ChatRequest {
  message: string;
  submissionId: string;
  assignmentId: string;
  isInitialGreeting?: boolean;
  /** When `isInitialGreeting` is true: default = brief greeting; explain_task = clarify assignment first. */
  initialGreetingMode?: InitialGreetingMode;
  /** When true (student chose "don't understand"), lighter tutoring after the explain turn. */
  postExplainTutoring?: boolean;
  /** Help panel alongside another assignment UI (test, essay, etc.) — not the primary submission surface. */
  companionMode?: boolean;
  language?: string;
  fileContext?: { name: string; content: string; url?: string; type?: string };
  /** App admins only; Edge Function verifies `is_app_admin`. */
  debugChat?: boolean;
  /** Optional; edge validates ownership + classroom before injecting into system prompt (new threads only). */
  priorSubmissionId?: string;
  /** Ordered prior submissions (e.g. oldest → newest) to merge into one context block. */
  priorSubmissionIds?: string[];
}

export interface ChatResponse {
  message: string;
  turnCount?: number;
  shouldEnd?: boolean;
  endReason?: string;
  debug?: ChatDebugPayload;
}

// Feedback API Types
export interface FeedbackRequest {
  submissionId: string;
  studentId: string;
  assignmentId: string;
  language?: string;
  /** When true, edge function returns 202 immediately and runs evaluation in the background. */
  background?: boolean;
  /** When true, delete prior feedback/snapshots before generating (teacher regenerate). */
  regenerate?: boolean;
}

export interface FeedbackResponse {
  studentFeedback: string;
  teacherFeedback: string | null;
}

// Analytics Types
export interface StudentAnalytics {
  id: string;
  fullName: string;
  latestScores: FiveDScores | null;
  feedbackCount: number;
}

export interface ClassroomAnalytics {
  studentCount: number;
  assignmentCount: number;
  totalSubmissions: number;
  completionRate: number;
  classAverage: FiveDScores | null;
  students: StudentAnalytics[];
}

// Error Types
export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

/** Structured context when course package merge fails (see ApiError.details.merge). */
export type MergeFailurePhase =
  | 'exported_from_guard'
  | 'classroom_patch'
  | 'syllabus_fetch'
  | 'syllabus_mismatch'
  | 'syllabus_patch'
  | 'grading_categories'
  | 'sections'
  | 'activities'
  | 'section_prerequisites'
  | 'assignments'
  | 'assignment_links'
  | 'module_flow';

export type MergeFailureEntity =
  | 'grading_category'
  | 'section'
  | 'activity'
  | 'assignment'
  | 'flow_step';

export interface MergeFailureContext {
  phase: MergeFailurePhase;
  /** 0-based index into package array for the active loop, when applicable. */
  indexInPkg?: number;
  entity?: MergeFailureEntity;
  /** Id from the merge file (UUID), when present. */
  entityId?: string;
  /** Short human label (e.g. section title). */
  humanLabel?: string;
  /** True when merge ran via atomic Postgres RPC (full rollback on error). */
  atomic?: boolean;
}

export function isMergeFailureContext(v: unknown): v is MergeFailureContext {
  if (v === null || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.phase === 'string';
}

export function getMergeFailureFromApiError(err: ApiError | null | undefined): MergeFailureContext | null {
  if (!err?.details || typeof err.details !== 'object') return null;
  const d = err.details as Record<string, unknown>;
  const m = d.merge;
  return isMergeFailureContext(m) ? m : null;
}
