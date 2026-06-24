import { supabase } from '@/integrations/supabase/client';
import { isChatLikeAssignmentType } from '@/lib/assignmentChatLike';
import {
  buildStudentWorkExport,
  buildSubmissionExportFilename,
  downloadJsonFile,
  type SubmissionStudentWorkExport,
} from '@/lib/submissionExportHelpers';
import {
  getAssignmentChatSentenceFlags,
  getAssignmentClipboardEvents,
  getAssignmentConversationMessages,
  getFullSubmissionDetails,
} from '@/services/submissionService';
import type { Message } from '@/types';

export type SubmissionExportPayload = {
  exported_at: string;
  assignment: {
    id: string;
    title: string;
    type: string;
    instructions: string | null;
    due_at: string | null;
    classroom_id: string;
    enable_ai_feedback: boolean | null;
    auto_publish_ai_feedback: boolean | null;
    student_facing_task: string | null;
    opik_trace_ids: Record<string, string> | null;
  };
  student: { id: string; name: string };
  submission: {
    id: string;
    status: string;
    submitted_at: string | null;
    attempt_number: number | null;
    evaluation_status: string | null;
    is_teacher_attempt: boolean;
    awaiting_teacher_feedback_release: boolean | null;
    conversation_complete_at_submit: boolean | null;
  };
  student_work: SubmissionStudentWorkExport;
  feedback: {
    teacher_feedback: string | null;
    student_feedback: string | null;
    visible_to_student: boolean | null;
    conversation_context: Message[];
  } | null;
  evaluation: {
    five_d_snapshot: Record<string, unknown> | null;
    hard_skill_assessments: Record<string, unknown>[];
  };
  alerts: Record<string, unknown>[];
  chat_sentence_flags?: Record<string, unknown>[];
  clipboard_events?: Record<string, unknown>[];
};

type FullSubmissionDetail = NonNullable<
  Awaited<ReturnType<typeof getFullSubmissionDetails>>['data']
>;

function mapDetailToPayload(
  detail: FullSubmissionDetail,
  studentWork: SubmissionStudentWorkExport,
  evaluation: SubmissionExportPayload['evaluation'],
  chatSentenceFlags?: Record<string, unknown>[],
  clipboardEvents?: Record<string, unknown>[],
): SubmissionExportPayload {
  const assignment = detail.assignments as {
    id: string;
    title: string;
    type: string;
    instructions: string | null;
    due_at: string | null;
    classroom_id: string;
    enable_ai_feedback: boolean | null;
    auto_publish_ai_feedback: boolean | null;
    student_facing_task: string | null;
    opik_trace_ids: Record<string, string> | null;
  };

  const feedback = detail.feedback as {
    teacher_feedback: string | null;
    student_feedback: string | null;
    visible_to_student: boolean | null;
    conversation_context: Message[];
  } | null;

  const payload: SubmissionExportPayload = {
    exported_at: new Date().toISOString(),
    assignment: {
      id: assignment.id,
      title: assignment.title,
      type: assignment.type,
      instructions: assignment.instructions ?? null,
      due_at: assignment.due_at ?? null,
      classroom_id: assignment.classroom_id,
      enable_ai_feedback: assignment.enable_ai_feedback ?? null,
      auto_publish_ai_feedback: assignment.auto_publish_ai_feedback ?? null,
      student_facing_task: assignment.student_facing_task ?? null,
      opik_trace_ids: assignment.opik_trace_ids ?? null,
    },
    student: {
      id: detail.student_id,
      name: detail.student_name || 'Student',
    },
    submission: {
      id: detail.id,
      status: detail.status,
      submitted_at: detail.submitted_at ?? null,
      attempt_number: detail.attempt_number ?? null,
      evaluation_status: detail.evaluation_status ?? null,
      is_teacher_attempt: detail.is_teacher_attempt ?? false,
      awaiting_teacher_feedback_release: detail.awaiting_teacher_feedback_release ?? null,
      conversation_complete_at_submit: detail.conversation_complete_at_submit ?? null,
    },
    student_work: studentWork,
    feedback: feedback
      ? {
          teacher_feedback: feedback.teacher_feedback ?? null,
          student_feedback: feedback.student_feedback ?? null,
          visible_to_student: feedback.visible_to_student ?? null,
          conversation_context: (feedback.conversation_context as Message[]) ?? [],
        }
      : null,
    evaluation,
    alerts: (detail.alerts as Record<string, unknown>[]) ?? [],
  };

  if (chatSentenceFlags && chatSentenceFlags.length > 0) {
    payload.chat_sentence_flags = chatSentenceFlags;
  }

  if (clipboardEvents && clipboardEvents.length > 0) {
    payload.clipboard_events = clipboardEvents;
  }

  return payload;
}

export async function buildSubmissionExportPayload(submissionId: string): Promise<SubmissionExportPayload> {
  const { data: detail, error } = await getFullSubmissionDetails(submissionId);
  if (error) {
    throw new Error(error.message);
  }
  if (!detail) {
    throw new Error('Submission not found');
  }

  const assignment = detail.assignments as { id: string; type: string };
  const assignmentType = assignment.type;
  const assignmentId = assignment.id;
  const isChatLike = isChatLikeAssignmentType(assignmentType);

  const feedbackContext = detail.feedback
    ? ((detail.feedback as { conversation_context?: Message[] }).conversation_context ?? [])
    : [];

  const [fiveDResult, hardSkillsResult, conversationResult, flagsResult, clipboardResult, testQuestionsResult, testResponsesResult] =
    await Promise.all([
      supabase.from('five_d_snapshots').select('*').eq('submission_id', submissionId).maybeSingle(),
      supabase.from('hard_skill_assessments').select('*').eq('submission_id', submissionId),
      isChatLike ? getAssignmentConversationMessages(submissionId) : Promise.resolve({ data: null, error: null }),
      isChatLike
        ? getAssignmentChatSentenceFlags(submissionId)
        : Promise.resolve({ data: [], error: null }),
      getAssignmentClipboardEvents(submissionId),
      assignmentType === 'test'
        ? supabase
            .from('test_questions')
            .select('*')
            .eq('assignment_id', assignmentId)
            .order('order_index', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      assignmentType === 'test'
        ? supabase.from('test_responses').select('*').eq('submission_id', submissionId)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (conversationResult.error) {
    throw new Error(conversationResult.error.message);
  }
  if (flagsResult.error) {
    throw new Error(flagsResult.error.message);
  }
  if (clipboardResult.error) {
    throw new Error(clipboardResult.error.message);
  }
  if (testQuestionsResult.error) {
    throw new Error(testQuestionsResult.error.message);
  }
  if (testResponsesResult.error) {
    throw new Error(testResponsesResult.error.message);
  }

  const studentWork = buildStudentWorkExport(
    assignmentType,
    detail,
    {
      messages: conversationResult.data,
      testQuestions: (testQuestionsResult.data as Record<string, unknown>[]) ?? [],
      testResponses: (testResponsesResult.data as Record<string, unknown>[]) ?? [],
    },
    feedbackContext,
  );

  const evaluation: SubmissionExportPayload['evaluation'] = {
    five_d_snapshot: (fiveDResult.data as Record<string, unknown> | null) ?? null,
    hard_skill_assessments: (hardSkillsResult.data as Record<string, unknown>[]) ?? [],
  };

  const chatFlags = (flagsResult.data as Record<string, unknown>[]) ?? [];
  const clipboardEvents = (clipboardResult.data as Record<string, unknown>[]) ?? [];

  return mapDetailToPayload(
    detail,
    studentWork,
    evaluation,
    chatFlags.length > 0 ? chatFlags : undefined,
    clipboardEvents.length > 0 ? clipboardEvents : undefined,
  );
}

export async function exportSubmissionJson(submissionId: string): Promise<string> {
  const payload = await buildSubmissionExportPayload(submissionId);
  const filename = buildSubmissionExportFilename(payload.assignment.title, payload.student.name);
  downloadJsonFile(payload, filename);
  return filename;
}

export {
  buildStudentWorkExport,
  buildSubmissionExportFilename,
  downloadJsonFile,
  parseLangchainPipeline,
  sanitizeExportFilenamePart,
} from '@/lib/submissionExportHelpers';
