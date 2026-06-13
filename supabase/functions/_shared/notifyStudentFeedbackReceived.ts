import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { logError } from '../shared/logger.ts';

/** Notify a student that assignment feedback is visible (auto-publish or teacher release). */
export async function notifyStudentFeedbackReceived(
  supabase: SupabaseClient,
  params: {
    studentId: string;
    assignmentId: string;
    assignmentTitle: string;
    submissionId: string;
    teacherId?: string | null;
  },
): Promise<void> {
  const { studentId, assignmentId, assignmentTitle, submissionId, teacherId } = params;
  const { error } = await supabase.from('notifications').insert({
    user_id: studentId,
    type: 'feedback_received',
    title: 'Feedback Received',
    message: `Your feedback for "${assignmentTitle}" is ready.`,
    link: `/student/assignment/${assignmentId}`,
    actor_id: teacherId ?? null,
    metadata: {
      assignment_id: assignmentId,
      assignment_title: assignmentTitle,
      submission_id: submissionId,
    },
    is_read: false,
  });
  if (error) {
    logError('Student feedback notification error', error);
  }
}
