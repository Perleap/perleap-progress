/**
 * Generate Feedback - OpenAI Integration
 * Uses shared rubric-based evaluation pipeline.
 * Supports synchronous (teacher retry) and background (student submit) modes.
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { handleOpenAIError } from '../shared/openai.ts';
import {
  createSupabaseClient,
  getAssignmentModuleActivityContextText,
  getServiceRoleKey,
  getStudentName,
  getTeacherNameByAssignment,
} from '../shared/supabase.ts';
import { logInfo, logError } from '../shared/logger.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';
import { queueOpikTrace, uuidv7 } from '../shared/opikTrace.ts';
import { notifyStudentFeedbackReceived } from '../_shared/notifyStudentFeedbackReceived.ts';
import { parseHardSkillsFromDb } from '../_shared/hardSkillsFormat.ts';
import { buildStudentWorkContext } from '../_shared/evaluationContext.ts';
import { runEvaluation, seedFromSubmissionId } from '../_shared/evaluation.ts';
import { persistAiEvaluation } from '../_shared/evaluationPersist.ts';

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EvaluationStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface FeedbackRequestBody {
  submissionId: string;
  studentId: string;
  assignmentId: string;
  language?: string;
  background?: boolean;
}

interface FeedbackPipelineResult {
  studentFeedback: string;
  teacherFeedback: string;
}

async function setEvaluationStatus(
  supabase: SupabaseClient,
  submissionId: string,
  status: EvaluationStatus,
): Promise<void> {
  const { error } = await supabase
    .from('submissions')
    .update({ evaluation_status: status })
    .eq('id', submissionId);
  if (error) {
    logError('Error updating evaluation_status', error);
    throw error;
  }
}

async function runFeedbackPipeline(
  supabase: SupabaseClient,
  params: FeedbackRequestBody,
): Promise<FeedbackPipelineResult> {
  const { submissionId, studentId, assignmentId, language = 'en' } = params;
  const startTime = Date.now();

  const [studentName, teacherName, assignmentResult] = await Promise.all([
    getStudentName(studentId),
    getTeacherNameByAssignment(assignmentId),
    supabase
      .from('assignments')
      .select(
        'classroom_id, title, instructions, hard_skills, hard_skill_domain, type, enable_ai_feedback, auto_publish_ai_feedback, classrooms(teacher_id)',
      )
      .eq('id', assignmentId)
      .single(),
  ]);

  const assignmentData = assignmentResult.data;
  const teacherId = (assignmentData?.classrooms as { teacher_id?: string })?.teacher_id;
  const classroomId = assignmentData?.classroom_id;
  const assignmentType = assignmentData?.type;
  const autoPublishAiFeedback = assignmentData?.auto_publish_ai_feedback !== false;

  const [workContext, moduleActivityContextText] = await Promise.all([
    buildStudentWorkContext(
      supabase,
      submissionId,
      assignmentId,
      assignmentType,
    ),
    getAssignmentModuleActivityContextText(assignmentId),
  ]);

  logInfo('Starting rubric evaluation...');
  const aiStartTime = Date.now();

  const skillPairs = parseHardSkillsFromDb(
    assignmentData?.hard_skills,
    assignmentData?.hard_skill_domain,
  );

  const opikThreadId = typeof submissionId === 'string' && submissionId
    ? submissionId
    : crypto.randomUUID();
  const feedbackTraceId = uuidv7();
  const hardSkillsTraceId = uuidv7();

  const evaluation = await runEvaluation(
    {
      language,
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
          traceName: 'generate-feedback.main',
          tags: ['generate-feedback', 'edge-function'],
          threadId: opikThreadId,
          clientTraceId: feedbackTraceId,
          traceStartMs: t.traceStartMs,
          traceEndMs: t.traceEndMs,
          input: {
            ...t.input,
            context_type: workContext.contextLabel,
            conversation_chars: workContext.studentWorkText.length,
          },
          output: t.output,
          openaiUsage: t.usage,
          llmModel: t.model,
          metadata: {
            edge_function: 'generate-feedback',
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
          traceName: 'generate-feedback.hard-skills',
          tags: ['generate-feedback', 'edge-function'],
          threadId: opikThreadId,
          clientTraceId: hardSkillsTraceId,
          traceStartMs: t.traceStartMs,
          traceEndMs: t.traceEndMs,
          input: {
            ...t.input,
            context_type: workContext.contextLabel,
            conversation_chars: workContext.studentWorkText.length,
          },
          output: t.output,
          openaiUsage: t.usage,
          llmModel: t.model,
          metadata: {
            edge_function: 'generate-feedback',
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

  const { studentFeedback, teacherFeedback, scores, scoreExplanations, qedMeasures, hardSkillsAssessment } =
    evaluation;

  logInfo(`AI calls completed in ${Date.now() - aiStartTime}ms`);

  logInfo('Saving essential data to database...');
  const dbStartTime = Date.now();
  const visibleToStudent = autoPublishAiFeedback;

  await persistAiEvaluation(supabase, {
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
    hardSkillDomain: assignmentData?.hard_skill_domain,
    evaluationSource: 'ai_student_work',
    conversationContext: workContext.conversationMessages,
    visibleToStudent,
    opikTraceIds: {
      feedback_main: feedbackTraceId,
      hard_skills: hardSkillsTraceId,
    },
  });

  const { error: submissionFlagError } = await supabase
    .from('submissions')
    .update({
      awaiting_teacher_feedback_release: !visibleToStudent,
      evaluation_status: 'completed',
    })
    .eq('id', submissionId);

  if (submissionFlagError) {
    logError('Error updating submission release flags', submissionFlagError);
    throw submissionFlagError;
  }

  logInfo(`Essential database operations completed in ${Date.now() - dbStartTime}ms`);

  void runPostEvaluationSideEffects({
    supabase,
    studentId,
    studentName,
    submissionId,
    assignmentId,
    teacherId,
    assignmentData,
    workContext,
    visibleToStudent,
  });

  logInfo(`Total feedback generation time (excluding background tasks): ${Date.now() - startTime}ms`);

  return { studentFeedback, teacherFeedback };
}

function runPostEvaluationSideEffects(args: {
  supabase: SupabaseClient;
  studentId: string;
  studentName: string;
  submissionId: string;
  assignmentId: string;
  teacherId?: string;
  assignmentData: { title?: string } | null | undefined;
  workContext: Awaited<ReturnType<typeof buildStudentWorkContext>>;
  visibleToStudent: boolean;
}): void {
  const {
    supabase,
    studentId,
    studentName,
    submissionId,
    assignmentId,
    teacherId,
    assignmentData,
    workContext,
    visibleToStudent,
  } = args;

  (async () => {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const wellbeingUrl = `${supabaseUrl}/functions/v1/analyze-student-wellbeing`;
      const serviceKey = getServiceRoleKey();

      fetch(wellbeingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          studentId,
          studentName,
          submissionId,
          assignmentId,
          teacherId,
          assignmentTitle: assignmentData?.title,
          conversationMessages: workContext.conversationMessages,
        }),
      }).catch((err) => logError('Wellbeing call error', err));

      if (assignmentData) {
        const assignmentTitle = assignmentData.title;
        const notifications: PromiseLike<unknown>[] = [];
        if (teacherId) {
          notifications.push(
            supabase.from('notifications').insert({
              user_id: teacherId,
              type: 'student_completed_activity',
              title: 'Activity Completed',
              message: `${studentName} completed "${assignmentTitle}"`,
              link: `/teacher/submission/${submissionId}`,
              actor_id: studentId,
              metadata: {
                assignment_id: assignmentId,
                assignment_title: assignmentTitle,
                student_id: studentId,
                student_name: studentName,
                submission_id: submissionId,
              },
              is_read: false,
            }),
          );
        }
        if (visibleToStudent && assignmentTitle) {
          notifications.push(
            notifyStudentFeedbackReceived(supabase, {
              studentId,
              assignmentId,
              assignmentTitle,
              submissionId,
              teacherId,
            }),
          );
        }
        await Promise.all(notifications).catch((err) => logError('Notifications error', err));
      }
    } catch (err) {
      logError('Background tasks execution error', err);
    }
  })();
}

async function handlePipelineFailure(
  supabase: SupabaseClient,
  submissionId: string | undefined,
  error: unknown,
  req: Request,
): Promise<Response> {
  const errorMessage = handleOpenAIError(error);
  logError('Error in generate-feedback', error);

  if (submissionId) {
    await supabase
      .from('submissions')
      .update({ evaluation_status: 'failed' })
      .eq('id', submissionId)
      .then(({ error: statusErr }) => {
        if (statusErr) logError('Error marking evaluation_status failed', statusErr);
      });
  }

  await persistEdgeFunctionLog(
    {
      functionName: 'generate-feedback',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let submissionId: string | undefined;
  const supabase = createSupabaseClient();

  try {
    const body = (await req.json()) as FeedbackRequestBody;
    submissionId = body.submissionId;
    const { studentId, assignmentId, language = 'en', background = false } = body;

    if (!submissionId || !studentId || !assignmentId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pipelineParams: FeedbackRequestBody = {
      submissionId,
      studentId,
      assignmentId,
      language,
    };

    if (background) {
      await setEvaluationStatus(supabase, submissionId, 'processing');

      const backgroundTask = runFeedbackPipeline(supabase, pipelineParams).catch(async (err) => {
        logError('Background feedback pipeline failed', err);
        await supabase
          .from('submissions')
          .update({ evaluation_status: 'failed' })
          .eq('id', submissionId!)
          .then(({ error: statusErr }) => {
            if (statusErr) logError('Error marking evaluation_status failed', statusErr);
          });
        await persistEdgeFunctionLog(
          {
            functionName: 'generate-feedback',
            level: 'error',
            httpStatus: 500,
            message: handleOpenAIError(err),
            stack: errorToStack(err),
          },
          req,
        );
      });

      EdgeRuntime.waitUntil(backgroundTask);

      return new Response(JSON.stringify({ accepted: true }), {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await runFeedbackPipeline(supabase, pipelineParams);

    return new Response(
      JSON.stringify({
        studentFeedback: result.studentFeedback,
        teacherFeedback: result.teacherFeedback,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return handlePipelineFailure(supabase, submissionId, error, req);
  }
});
