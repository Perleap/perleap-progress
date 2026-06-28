/**
 * Regenerate Scores - single submission re-eval using shared persist helper.
 * Skips teacher_manual evaluations. Prefer refresh-class-evaluations for classroom batch + Undo.
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  createSupabaseClient,
  getAssignmentModuleActivityContextText,
  getStudentName,
  getTeacherNameByAssignment,
} from '../shared/supabase.ts';
import { handleOpenAIError } from '../shared/openai.ts';
import { logInfo, logError } from '../shared/logger.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';
import { queueOpikTrace, uuidv7 } from '../shared/opikTrace.ts';
import { parseHardSkillsFromDb } from '../_shared/hardSkillsFormat.ts';
import {
  buildStudentWorkContext,
  detectLanguageFromText,
} from '../_shared/evaluationContext.ts';
import { runEvaluation, seedFromSubmissionId } from '../_shared/evaluation.ts';
import { persistAiEvaluation } from '../_shared/evaluationPersist.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { submissionId } = await req.json();
    logInfo('Regenerate scores request', { submissionId });

    if (!submissionId) {
      throw new Error('submissionId is required');
    }

    const supabase = createSupabaseClient();

    const { data: feedbackRow } = await supabase
      .from('assignment_feedback')
      .select('evaluation_source, visible_to_student')
      .eq('submission_id', submissionId)
      .maybeSingle();

    if (feedbackRow?.evaluation_source === 'teacher_manual') {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'teacher_manual' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: submissionData, error: subErr } = await supabase
      .from('submissions')
      .select('student_id, assignment_id')
      .eq('id', submissionId)
      .single();

    if (subErr || !submissionData) {
      throw new Error('Submission not found.');
    }

    const studentId = submissionData.student_id;
    const assignmentId = submissionData.assignment_id;

    const { data: assignmentData } = await supabase
      .from('assignments')
      .select('classroom_id, title, instructions, hard_skills, hard_skill_domain, type')
      .eq('id', assignmentId)
      .single();

    const classroomId = assignmentData?.classroom_id;
    const assignmentType = assignmentData?.type;

    const [workContext, moduleActivityContextText, studentName, teacherName] = await Promise.all([
      buildStudentWorkContext(supabase, submissionId, assignmentId, assignmentType),
      getAssignmentModuleActivityContextText(assignmentId),
      getStudentName(studentId),
      getTeacherNameByAssignment(assignmentId),
    ]);

    const detectedLanguage = detectLanguageFromText(workContext.studentWorkText);
    logInfo('Detected language', { detectedLanguage });

    const skillPairs = parseHardSkillsFromDb(
      assignmentData?.hard_skills,
      assignmentData?.hard_skill_domain,
    );

    const opikThreadId = submissionId;
    const feedbackTraceId = uuidv7();

    const evaluation = await runEvaluation(
      {
        language: detectedLanguage,
        studentName,
        teacherName,
        assignmentTitle: assignmentData?.title || '',
        assignmentType: assignmentType || 'questions',
        assignmentInstructions: assignmentData?.instructions || '',
        moduleActivityContextText,
        studentWorkText: workContext.studentWorkText,
        mode: 'student_work',
        skillPairs,
        hardSkillDomain: assignmentData?.hard_skill_domain,
        seed: seedFromSubmissionId(submissionId),
      },
      {
        onMainTrace: (t) => {
          void queueOpikTrace({
            traceName: 'regenerate-scores.main',
            tags: ['regenerate-scores', 'edge-function'],
            threadId: opikThreadId,
            clientTraceId: feedbackTraceId,
            traceStartMs: t.traceStartMs,
            traceEndMs: t.traceEndMs,
            input: {
              ...t.input,
              detected_language: detectedLanguage,
              conversation_chars: workContext.studentWorkText.length,
            },
            output: t.output,
            openaiUsage: t.usage,
            llmModel: t.model,
            metadata: {
              edge_function: 'regenerate-scores',
              model_tier: 'smart',
              submission_id: submissionId,
              assignment_id: assignmentId,
              classroom_id: classroomId,
              student_id: studentId,
            },
          }).catch(() => undefined);
        },
      },
    );

    await persistAiEvaluation(supabase, {
      submissionId,
      studentId,
      assignmentId,
      classroomId,
      scores: evaluation.scores,
      scoreExplanations: evaluation.scoreExplanations,
      qedMeasures: evaluation.qedMeasures,
      studentFeedback: evaluation.studentFeedback,
      teacherFeedback: evaluation.teacherFeedback,
      hardSkillsAssessment: evaluation.hardSkillsAssessment,
      skillPairs,
      hardSkillDomain: assignmentData?.hard_skill_domain,
      evaluationSource: 'ai_student_work',
      visibleToStudent: feedbackRow?.visible_to_student ?? true,
      opikTraceIds: { feedback_main: feedbackTraceId },
    });

    return new Response(JSON.stringify({ scores: evaluation.scores }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = handleOpenAIError(error);
    logError('Error in regenerate-scores', error);
    await persistEdgeFunctionLog(
      {
        functionName: 'regenerate-scores',
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
