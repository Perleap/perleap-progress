/**
 * Sync user-reported AI content flags to Opik feedback scores.
 * Called fire-and-forget after Supabase flag RPCs succeed.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import {
  OPIK_FEEDBACK_SCORE_STUDENT_FLAG,
  OPIK_FEEDBACK_SCORE_TEACHER_FLAG,
  queueOpikFeedbackScore,
} from '../shared/opikTrace.ts';
import { createSupabaseClient, getServiceRoleKey } from '../shared/supabase.ts';
import { persistEdgeFunctionLog, errorToMessage, errorToStack } from '../shared/persistEdgeFunctionLog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ChatSentenceBody = {
  type: 'chat_sentence';
  submissionId: string;
  messageIndex: number;
  sentenceText: string;
};

type TeacherContentBody = {
  type: 'teacher_content';
  contentType: 'student_feedback' | 'teacher_feedback' | 'student_facing_task' | 'instructions';
  assignmentId?: string;
  submissionId?: string;
  contentExcerpt?: string;
  opikTraceId?: string;
};

type RequestBody = ChatSentenceBody | TeacherContentBody;

function truncateReason(text: string, max = 500): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max) + '…';
}

function readTraceIdFromJsonb(
  raw: unknown,
  key: string,
): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const val = (raw as Record<string, unknown>)[key];
  return typeof val === 'string' && val.trim() ? val.trim() : null;
}

const TEACHER_CONTENT_TRACE_KEYS: Record<
  TeacherContentBody['contentType'],
  { table: 'assignment_feedback' | 'assignments'; key: string }
> = {
  student_feedback: { table: 'assignment_feedback', key: 'feedback_main' },
  teacher_feedback: { table: 'assignment_feedback', key: 'feedback_main' },
  student_facing_task: { table: 'assignments', key: 'student_facing_task' },
  instructions: { table: 'assignments', key: 'instructions' },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as RequestBody;
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = getServiceRoleKey();
    const authClient = createClient(supabaseUrl, serviceKey);
    const admin = createSupabaseClient();

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let opikTraceId: string | null = null;
    let feedbackName: string = OPIK_FEEDBACK_SCORE_STUDENT_FLAG;
    let reason = '';

    if (body.type === 'chat_sentence') {
      const { submissionId, messageIndex, sentenceText } = body;
      if (!submissionId || typeof messageIndex !== 'number') {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: submission, error: subErr } = await admin
        .from('submissions')
        .select('student_id')
        .eq('id', submissionId)
        .maybeSingle();
      if (subErr || !submission) {
        return new Response(JSON.stringify({ error: 'Submission not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (submission.student_id !== userData.user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: conv, error: convErr } = await admin
        .from('assignment_conversations')
        .select('messages')
        .eq('submission_id', submissionId)
        .maybeSingle();
      if (convErr || !conv?.messages || !Array.isArray(conv.messages)) {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_conversation' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const msg = conv.messages[messageIndex] as { opik_client_trace_id?: string } | undefined;
      opikTraceId = typeof msg?.opik_client_trace_id === 'string' ? msg.opik_client_trace_id : null;
      feedbackName = OPIK_FEEDBACK_SCORE_STUDENT_FLAG;
      reason = truncateReason(`Flagged sentence: "${sentenceText ?? ''}"`);
    } else if (body.type === 'teacher_content') {
      feedbackName = OPIK_FEEDBACK_SCORE_TEACHER_FLAG;
      reason = truncateReason(
        `${body.contentType}: ${body.contentExcerpt ?? ''}`,
      );

      let teacherAuthorized = Boolean(body.opikTraceId?.trim());
      if (body.submissionId) {
        const { data: row } = await admin
          .from('submissions')
          .select('assignment_id, assignments(classroom_id, classrooms(teacher_id))')
          .eq('id', body.submissionId)
          .maybeSingle();
        const teacherId = (row?.assignments as { classrooms?: { teacher_id?: string } } | null)
          ?.classrooms?.teacher_id;
        teacherAuthorized = teacherId === userData.user.id;
      } else if (body.assignmentId) {
        const { data: row } = await admin
          .from('assignments')
          .select('classrooms(teacher_id)')
          .eq('id', body.assignmentId)
          .maybeSingle();
        const teacherId = (row?.classrooms as { teacher_id?: string } | null)?.teacher_id;
        teacherAuthorized = teacherId === userData.user.id;
      }

      if (!teacherAuthorized) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (body.opikTraceId?.trim()) {
        opikTraceId = body.opikTraceId.trim();
      } else {
        const mapping = TEACHER_CONTENT_TRACE_KEYS[body.contentType];
        if (mapping.table === 'assignment_feedback' && body.submissionId) {
          const { data: fb } = await admin
            .from('assignment_feedback')
            .select('opik_trace_ids')
            .eq('submission_id', body.submissionId)
            .maybeSingle();
          opikTraceId = readTraceIdFromJsonb(fb?.opik_trace_ids, mapping.key);
        } else if (mapping.table === 'assignments' && body.assignmentId) {
          const { data: asg } = await admin
            .from('assignments')
            .select('opik_trace_ids')
            .eq('id', body.assignmentId)
            .maybeSingle();
          opikTraceId = readTraceIdFromJsonb(asg?.opik_trace_ids, mapping.key);
        }
      }
    } else {
      return new Response(JSON.stringify({ error: 'Unknown type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!opikTraceId) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_trace_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      await queueOpikFeedbackScore({
        traceId: opikTraceId,
        name: feedbackName,
        value: 0,
        reason,
      });
    } catch (opikErr) {
      await persistEdgeFunctionLog(
        {
          functionName: 'opik-ai-flag-feedback',
          level: 'warn',
          httpStatus: 502,
          message: errorToMessage(opikErr),
          stack: errorToStack(opikErr),
          context: { opikTraceId, feedbackName, bodyType: body.type },
        },
        req,
      );
      return new Response(JSON.stringify({ ok: true, opik_synced: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, opik_synced: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = errorToMessage(error);
    await persistEdgeFunctionLog(
      {
        functionName: 'opik-ai-flag-feedback',
        level: 'error',
        httpStatus: 500,
        message,
        stack: errorToStack(error),
      },
      req,
    );
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
