export const DEFAULT_REFRESH_CONCURRENCY = 4;
export const DEFAULT_SECONDS_PER_SUBMISSION = 28;

export type EligibleRefreshMeta = {
  studentCount: number;
  submissionCount: number;
};

async function loadEligibleRefreshRows(
  classroomId: string,
): Promise<{ studentIds: Set<string>; submissionCount: number } | null> {
  const { supabase } = await import('@/integrations/supabase/client');

  const { data: assignments, error: assignmentsError } = await supabase
    .from('assignments')
    .select('id')
    .eq('classroom_id', classroomId);

  if (assignmentsError) throw assignmentsError;
  if (!assignments?.length) return null;

  const assignmentIds = assignments.map((a) => a.id);

  const { data: submissions, error: submissionsError } = await supabase
    .from('submissions')
    .select('id, student_id')
    .in('assignment_id', assignmentIds);

  if (submissionsError) throw submissionsError;
  if (!submissions?.length) return null;

  const submissionIds = submissions.map((s) => s.id);

  const { data: feedbackRows, error: feedbackError } = await supabase
    .from('assignment_feedback')
    .select('submission_id, evaluation_source')
    .in('submission_id', submissionIds);

  if (feedbackError) throw feedbackError;

  const eligibleSubmissionIds = new Set(
    (feedbackRows ?? [])
      .filter((f) => f.evaluation_source !== 'teacher_manual')
      .map((f) => f.submission_id),
  );

  const studentIds = new Set<string>();
  for (const sub of submissions) {
    if (eligibleSubmissionIds.has(sub.id)) {
      studentIds.add(sub.student_id);
    }
  }

  return { studentIds, submissionCount: eligibleSubmissionIds.size };
}

/** Unique students with at least one eligible AI-evaluated submission. */
export async function countEligibleRefreshStudents(classroomId: string): Promise<number> {
  const rows = await loadEligibleRefreshRows(classroomId);
  return rows?.studentIds.size ?? 0;
}

/** Total eligible submissions (internal / server parity). */
export async function countEligibleRefreshSubmissions(classroomId: string): Promise<number> {
  const rows = await loadEligibleRefreshRows(classroomId);
  return rows?.submissionCount ?? 0;
}

export async function getEligibleRefreshMeta(classroomId: string): Promise<EligibleRefreshMeta> {
  const rows = await loadEligibleRefreshRows(classroomId);
  return {
    studentCount: rows?.studentIds.size ?? 0,
    submissionCount: rows?.submissionCount ?? 0,
  };
}

/** Wall-clock estimate from student count and submission volume. */
export function estimateRefreshDurationSeconds(
  studentCount: number,
  submissionCount?: number,
  concurrency = DEFAULT_REFRESH_CONCURRENCY,
  secondsPerSubmission = DEFAULT_SECONDS_PER_SUBMISSION,
): number {
  if (studentCount <= 0) return 0;
  const subs = submissionCount ?? studentCount;
  const avgSubsPerStudent = subs / studentCount;
  const secondsPerStudent = Math.max(
    secondsPerSubmission,
    Math.ceil(avgSubsPerStudent) * secondsPerSubmission,
  );
  return Math.ceil(studentCount / concurrency) * secondsPerStudent;
}

export function estimateSecondsPerStudent(
  studentCount: number,
  submissionCount: number,
  concurrency = DEFAULT_REFRESH_CONCURRENCY,
  secondsPerSubmission = DEFAULT_SECONDS_PER_SUBMISSION,
): number {
  if (studentCount <= 0) return secondsPerSubmission;
  const avgSubsPerStudent = submissionCount / studentCount;
  const secondsPerStudent = Math.max(
    secondsPerSubmission,
    Math.ceil(avgSubsPerStudent) * secondsPerSubmission,
  );
  return Math.ceil(secondsPerStudent / concurrency) * concurrency;
}

/** Short human-readable duration for confirm dialog and ETA labels. */
export function formatEta(seconds: number): string {
  if (seconds <= 0) return '';
  if (seconds < 60) return `~${seconds} sec`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '~1 min' : `~${minutes} min`;
}
