import type { Database } from '@/integrations/supabase/types';

export type AssignmentAttemptMode = Database['public']['Enums']['assignment_attempt_mode'];

export function isPastDueForNewAttempts(dueAt: string | null, now: Date): boolean {
  if (!dueAt) return false;
  return now > new Date(dueAt);
}

/** Whether the student may open a first in-progress attempt (no rows yet). */
export function canStartFirstAttempt(
  assignment: { attempt_mode: AssignmentAttemptMode | null; due_at: string | null },
  now: Date,
): boolean {
  const mode = assignment.attempt_mode ?? 'single';
  if (mode === 'multiple_until_due') {
    /** Without a due date, "until due" cannot apply — allow starting so students are not stuck with no submission row. */
    if (!assignment.due_at) return true;
    return !isPastDueForNewAttempts(assignment.due_at, now);
  }
  return true;
}

/** Whether after a completed attempt the student may start another (retry). */
export function canRetryAfterCompleting(
  assignment: { attempt_mode: AssignmentAttemptMode | null; due_at: string | null },
  now: Date,
): boolean {
  const mode = assignment.attempt_mode ?? 'single';
  if (mode === 'single') return false;
  if (mode === 'multiple_unlimited') return true;
  if (mode === 'multiple_until_due') {
    if (!assignment.due_at) return false;
    return !isPastDueForNewAttempts(assignment.due_at, now);
  }
  return false;
}
