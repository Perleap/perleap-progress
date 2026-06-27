/**
 * Shared persistence for AI evaluation outputs (5D, CRA, feedback text).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  domainForSkillComponent,
  type HardSkillPair,
} from './hardSkillsFormat.ts';
import type { EvaluationResult } from './evaluation.ts';
import type { EvalScoreExplanations, EvalQedMeasuresRecord } from './evaluationValidation.ts';
import { logError } from '../shared/logger.ts';

export type EvaluationSource = 'ai_student_work' | 'teacher_manual';

export interface PersistAiEvaluationParams {
  submissionId: string;
  studentId: string;
  assignmentId: string;
  classroomId: string | null | undefined;
  scores: EvaluationResult['scores'];
  scoreExplanations: EvalScoreExplanations;
  qedMeasures?: EvalQedMeasuresRecord | null;
  studentFeedback: string;
  teacherFeedback: string;
  hardSkillsAssessment: EvaluationResult['hardSkillsAssessment'];
  skillPairs: HardSkillPair[];
  hardSkillDomain?: string | null;
  evaluationSource: EvaluationSource;
  conversationContext?: Array<{ role: string; content: string }>;
  visibleToStudent?: boolean;
  opikTraceIds?: Record<string, string>;
}

export async function persistAiEvaluation(
  supabase: SupabaseClient,
  params: PersistAiEvaluationParams,
): Promise<void> {
  const {
    submissionId,
    studentId,
    assignmentId,
    classroomId,
    scores,
    scoreExplanations,
    qedMeasures,
    studentFeedback,
    teacherFeedback,
    hardSkillsAssessment,
    skillPairs,
    hardSkillDomain,
    evaluationSource,
    conversationContext,
    visibleToStudent,
    opikTraceIds,
  } = params;

  const { error: deleteSnapshotErr } = await supabase
    .from('five_d_snapshots')
    .delete()
    .eq('submission_id', submissionId);
  if (deleteSnapshotErr) {
    logError('Error deleting prior 5D snapshot', deleteSnapshotErr);
    throw deleteSnapshotErr;
  }

  const { error: snapshotErr } = await supabase.from('five_d_snapshots').insert({
    user_id: studentId,
    scores,
    score_explanations: scoreExplanations,
    qed_measures: qedMeasures ?? null,
    source: 'assignment',
    submission_id: submissionId,
    classroom_id: classroomId,
  });
  if (snapshotErr) {
    logError('Error saving 5D snapshot', snapshotErr);
    throw snapshotErr;
  }

  const { error: deleteHsErr } = await supabase
    .from('hard_skill_assessments')
    .delete()
    .eq('submission_id', submissionId);
  if (deleteHsErr) {
    logError('Error deleting prior hard skill assessments', deleteHsErr);
    throw deleteHsErr;
  }

  if (hardSkillsAssessment.length > 0) {
    const assessmentRecords = hardSkillsAssessment.map((assessment) => ({
      submission_id: submissionId,
      assignment_id: assignmentId,
      student_id: studentId,
      domain: domainForSkillComponent(
        skillPairs,
        assessment.skill_component,
        hardSkillDomain,
      ),
      skill_component: assessment.skill_component,
      current_level_percent: assessment.current_level_percent,
      proficiency_description: assessment.proficiency_description,
      actionable_challenge: assessment.actionable_challenge,
    }));
    const { error: hsErr } = await supabase
      .from('hard_skill_assessments')
      .insert(assessmentRecords);
    if (hsErr) {
      logError('Error saving hard skills', hsErr);
      throw hsErr;
    }
  }

  const { data: existingFeedback } = await supabase
    .from('assignment_feedback')
    .select('id')
    .eq('submission_id', submissionId)
    .maybeSingle();

  const feedbackPayload: Record<string, unknown> = {
    student_feedback: studentFeedback,
    teacher_feedback: teacherFeedback,
    evaluation_source: evaluationSource,
  };
  if (conversationContext !== undefined) {
    feedbackPayload.conversation_context = conversationContext;
  }
  if (visibleToStudent !== undefined) {
    feedbackPayload.visible_to_student = visibleToStudent;
  }
  if (opikTraceIds) {
    feedbackPayload.opik_trace_ids = opikTraceIds;
  }

  if (existingFeedback?.id) {
    const { error: updateErr } = await supabase
      .from('assignment_feedback')
      .update(feedbackPayload)
      .eq('submission_id', submissionId);
    if (updateErr) {
      logError('Error updating assignment feedback', updateErr);
      throw updateErr;
    }
  } else {
    const { error: insertErr } = await supabase.from('assignment_feedback').insert({
      submission_id: submissionId,
      student_id: studentId,
      assignment_id: assignmentId,
      ...feedbackPayload,
      conversation_context: conversationContext ?? [],
      visible_to_student: visibleToStudent ?? true,
      opik_trace_ids: opikTraceIds ?? {},
    });
    if (insertErr) {
      logError('Error inserting assignment feedback', insertErr);
      throw insertErr;
    }
  }
}
