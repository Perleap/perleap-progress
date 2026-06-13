/**
 * Evaluate from Teacher Feedback
 * Uses shared rubric-based evaluation pipeline.
 * Replaces any prior AI evaluation rows for the submission.
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleOpenAIError } from '../shared/openai.ts';
import {
  createSupabaseClient,
  getStudentName,
} from '../shared/supabase.ts';
import { logInfo, logError } from '../shared/logger.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';
import { queueOpikTrace, uuidv7 } from '../shared/opikTrace.ts';
import {
  domainForSkillComponent,
  parseHardSkillsFromDb,
} from '../_shared/hardSkillsFormat.ts';
import { runEvaluation, seedFromSubmissionId } from '../_shared/evaluation.ts';
import { notifyStudentFeedbackReceived } from '../_shared/notifyStudentFeedbackReceived.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function clearPriorEvaluation(
  supabase: ReturnType<typeof createSupabaseClient>,
  submissionId: string,
): Promise<void> {
  await Promise.all([
    supabase.from('five_d_snapshots').delete().eq('submission_id', submissionId),
    supabase.from('assignment_feedback').delete().eq('submission_id', submissionId),
    supabase.from('hard_skill_assessments').delete().eq('submission_id', submissionId),
  ]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      submissionId,
      studentId,
      assignmentId,
      teacherFeedback,
      language = 'en',
      sessionContext,
    } = await req.json();

    if (!submissionId || !studentId || !assignmentId || !teacherFeedback) {
      throw new Error('Missing required fields: submissionId, studentId, assignmentId, teacherFeedback');
    }

    const supabase = createSupabaseClient();
    const startTime = Date.now();

    const [studentName, assignmentResult] = await Promise.all([
      getStudentName(studentId),
      supabase
        .from('assignments')
        .select(
          'classroom_id, title, instructions, hard_skills, hard_skill_domain, type, auto_publish_ai_feedback, classrooms(teacher_id)',
        )
        .eq('id', assignmentId)
        .single(),
    ]);

    const assignmentData = assignmentResult.data;
    const classroomId = assignmentData?.classroom_id;
    const teacherId = (assignmentData?.classrooms as { teacher_id?: string })?.teacher_id;
    const autoPublishAiFeedback = assignmentData?.auto_publish_ai_feedback !== false;
    const visibleToStudent = autoPublishAiFeedback;

    const skillPairs = parseHardSkillsFromDb(
      assignmentData?.hard_skills,
      assignmentData?.hard_skill_domain,
    );

    const opikThreadId = typeof submissionId === 'string' && submissionId
      ? submissionId
      : crypto.randomUUID();

    logInfo('Starting rubric evaluation from teacher feedback...');

    const evaluation = await runEvaluation(
      {
        language,
        studentName,
        teacherName: 'Teacher',
        assignmentTitle: assignmentData?.title || '',
        assignmentType: assignmentData?.type || 'project',
        assignmentInstructions: assignmentData?.instructions || '',
        studentWorkText: teacherFeedback,
        mode: 'teacher_review',
        teacherFeedback,
        sessionContext,
        skillPairs,
        hardSkillDomain: assignmentData?.hard_skill_domain,
        seed: seedFromSubmissionId(submissionId),
      },
      {
        onMainTrace: (t) => {
          void queueOpikTrace({
            traceName: 'evaluate-from-feedback.main',
            tags: ['evaluate-from-feedback', 'edge-function'],
            threadId: opikThreadId,
            clientTraceId: uuidv7(),
            traceStartMs: t.traceStartMs,
            traceEndMs: t.traceEndMs,
            input: {
              ...t.input,
              teacher_feedback_chars: teacherFeedback.length,
            },
            output: t.output,
            openaiUsage: t.usage,
            llmModel: t.model,
            metadata: {
              edge_function: 'evaluate-from-feedback',
              model_tier: 'smart',
              assignment_id: assignmentId,
              submission_id: submissionId,
              student_id: studentId,
              classroom_id: classroomId,
            },
          }).catch(() => undefined);
        },
        onHardSkillsTrace: (t) => {
          void queueOpikTrace({
            traceName: 'evaluate-from-feedback.hard-skills',
            tags: ['evaluate-from-feedback', 'edge-function'],
            threadId: opikThreadId,
            clientTraceId: uuidv7(),
            traceStartMs: t.traceStartMs,
            traceEndMs: t.traceEndMs,
            input: {
              ...t.input,
              teacher_feedback_chars: teacherFeedback.length,
            },
            output: t.output,
            openaiUsage: t.usage,
            llmModel: t.model,
            metadata: {
              edge_function: 'evaluate-from-feedback',
              model_tier: 'fast',
              assignment_id: assignmentId,
              submission_id: submissionId,
              student_id: studentId,
              classroom_id: classroomId,
            },
          }).catch(() => undefined);
        },
      },
    );

    const { studentFeedback, scores, scoreExplanations, hardSkillsAssessment } = evaluation;

    await clearPriorEvaluation(supabase, submissionId);

    const [snapshotResult, feedbackSaveResult] = await Promise.all([
      supabase.from('five_d_snapshots').insert({
        user_id: studentId,
        scores,
        score_explanations: scoreExplanations,
        source: 'assignment',
        submission_id: submissionId,
        classroom_id: classroomId,
      }),

      supabase.from('assignment_feedback').insert({
        submission_id: submissionId,
        student_id: studentId,
        assignment_id: assignmentId,
        student_feedback: studentFeedback,
        teacher_feedback: teacherFeedback,
        conversation_context: [],
        visible_to_student: visibleToStudent,
      }),

      hardSkillsAssessment.length > 0
        ? (async () => {
            try {
              const records = hardSkillsAssessment.map((a) => ({
                submission_id: submissionId,
                assignment_id: assignmentId,
                student_id: studentId,
                domain: domainForSkillComponent(
                  skillPairs,
                  a.skill_component,
                  assignmentData?.hard_skill_domain,
                ),
                skill_component: a.skill_component,
                current_level_percent: a.current_level_percent,
                proficiency_description: a.proficiency_description,
                actionable_challenge: a.actionable_challenge,
              }));
              const { error: err } = await supabase.from('hard_skill_assessments').insert(records);
              if (err) logError('Error saving hard skills', err);
            } catch (e) {
              logError('Error processing hard skills', e);
            }
          })()
        : Promise.resolve({ error: null }),
    ]);

    if (snapshotResult.error) {
      logError('Error saving 5D snapshot', snapshotResult.error);
      throw snapshotResult.error;
    }
    if (feedbackSaveResult.error) {
      logError('Error saving feedback', feedbackSaveResult.error);
      throw feedbackSaveResult.error;
    }

    const { error: submissionFlagError } = await supabase
      .from('submissions')
      .update({ awaiting_teacher_feedback_release: !visibleToStudent })
      .eq('id', submissionId);

    if (submissionFlagError) {
      logError('Error updating submission release flags', submissionFlagError);
      throw submissionFlagError;
    }

    if (visibleToStudent && assignmentData?.title) {
      await notifyStudentFeedbackReceived(supabase, {
        studentId,
        assignmentId,
        assignmentTitle: assignmentData.title,
        submissionId,
        teacherId,
      });
    }

    logInfo(`Evaluate-from-feedback completed in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({ studentFeedback, scores }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const errorMessage = handleOpenAIError(error);
    logError('Error in evaluate-from-feedback', error);
    await persistEdgeFunctionLog(
      {
        functionName: 'evaluate-from-feedback',
        level: 'error',
        httpStatus: 500,
        message: errorMessage,
        stack: errorToStack(error),
      },
      req,
    );

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});