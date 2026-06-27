/**
 * Backup / restore helpers for classroom evaluation refresh (Undo).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { logError } from '../shared/logger.ts';

export interface SubmissionEvaluationBackup {
  submission_id: string;
  student_id: string;
  assignment_id: string;
  five_d_snapshot: {
    user_id: string;
    scores: unknown;
    score_explanations: unknown;
    qed_measures: unknown;
    source: string;
    classroom_id: string | null;
  } | null;
  hard_skill_assessments: Array<{
    domain: string;
    skill_component: string;
    current_level_percent: number;
    proficiency_description: string;
    actionable_challenge: string;
  }>;
  assignment_feedback: {
    student_feedback: string | null;
    teacher_feedback: string | null;
    evaluation_source: string | null;
  } | null;
}

export async function buildSubmissionBackup(
  supabase: SupabaseClient,
  submissionId: string,
  studentId: string,
  assignmentId: string,
): Promise<SubmissionEvaluationBackup> {
  const [snapshotRes, hsRes, feedbackRes] = await Promise.all([
    supabase
      .from('five_d_snapshots')
      .select('user_id, scores, score_explanations, qed_measures, source, classroom_id')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('hard_skill_assessments')
      .select(
        'domain, skill_component, current_level_percent, proficiency_description, actionable_challenge',
      )
      .eq('submission_id', submissionId),
    supabase
      .from('assignment_feedback')
      .select('student_feedback, teacher_feedback, evaluation_source')
      .eq('submission_id', submissionId)
      .maybeSingle(),
  ]);

  return {
    submission_id: submissionId,
    student_id: studentId,
    assignment_id: assignmentId,
    five_d_snapshot: snapshotRes.data ?? null,
    hard_skill_assessments: (hsRes.data ?? []) as SubmissionEvaluationBackup['hard_skill_assessments'],
    assignment_feedback: feedbackRes.data ?? null,
  };
}

export async function restoreSubmissionBackup(
  supabase: SupabaseClient,
  backup: SubmissionEvaluationBackup,
): Promise<void> {
  const { submission_id: submissionId, student_id: studentId, assignment_id: assignmentId } =
    backup;

  await supabase.from('five_d_snapshots').delete().eq('submission_id', submissionId);

  if (backup.five_d_snapshot) {
    const snap = backup.five_d_snapshot;
    const { error: snapErr } = await supabase.from('five_d_snapshots').insert({
      user_id: snap.user_id,
      scores: snap.scores,
      score_explanations: snap.score_explanations,
      qed_measures: snap.qed_measures ?? null,
      source: snap.source,
      submission_id: submissionId,
      classroom_id: snap.classroom_id,
    });
    if (snapErr) {
      logError('Error restoring 5D snapshot', snapErr);
      throw snapErr;
    }
  }

  await supabase.from('hard_skill_assessments').delete().eq('submission_id', submissionId);

  if (backup.hard_skill_assessments.length > 0) {
    const rows = backup.hard_skill_assessments.map((a) => ({
      submission_id: submissionId,
      assignment_id: assignmentId,
      student_id: studentId,
      domain: a.domain,
      skill_component: a.skill_component,
      current_level_percent: a.current_level_percent,
      proficiency_description: a.proficiency_description,
      actionable_challenge: a.actionable_challenge,
    }));
    const { error: hsErr } = await supabase.from('hard_skill_assessments').insert(rows);
    if (hsErr) {
      logError('Error restoring hard skills', hsErr);
      throw hsErr;
    }
  }

  if (backup.assignment_feedback) {
    const fb = backup.assignment_feedback;
    const { error: fbErr } = await supabase
      .from('assignment_feedback')
      .update({
        student_feedback: fb.student_feedback,
        teacher_feedback: fb.teacher_feedback,
        evaluation_source: fb.evaluation_source,
      })
      .eq('submission_id', submissionId);
    if (fbErr) {
      logError('Error restoring assignment feedback', fbErr);
      throw fbErr;
    }
  }
}
