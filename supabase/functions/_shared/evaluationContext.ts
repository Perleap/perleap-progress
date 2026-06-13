/**
 * Build student work text and metadata from submission + assignment type.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import { optionLabelsForIds, parseOptionIds } from '../shared/testMcq.ts';
import { ensureProjectFilesTranscript } from './extractSubmissionFilesText.ts';
import { ensurePresentationTranscript } from './presentationTranscribe.ts';

export type EvaluationInputKind = 'conversation' | 'essay' | 'test' | 'teacher_review' | 'artifact';

export interface BuiltEvaluationContext {
  studentWorkText: string;
  conversationMessages: Array<{ role: string; content: string }>;
  inputKind: EvaluationInputKind;
  contextLabel: string;
}

type PipelineNode = {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
};

type PipelineEdge = {
  source?: string;
  target?: string;
};

function formatLangchainPipelineText(textBody: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(textBody);
  } catch {
    return `Langchain pipeline (raw JSON):\n\n${textBody}`;
  }

  const obj = parsed as Record<string, unknown>;
  const nodes = (Array.isArray(obj.nodes) ? obj.nodes : []) as PipelineNode[];
  const edges = (Array.isArray(obj.edges) ? obj.edges : []) as PipelineEdge[];

  if (nodes.length === 0) {
    return 'Langchain pipeline: (empty graph)';
  }

  const nodeLines = nodes.map((node, index) => {
    const data = node.data ?? {};
    const label = typeof data.label === 'string' && data.label.trim()
      ? data.label.trim()
      : node.type ?? 'node';
    const details: string[] = [`${index + 1}. [${node.type ?? 'unknown'}] ${label}`];

    if (typeof data.description === 'string' && data.description.trim()) {
      details.push(`   Description: ${data.description.trim()}`);
    }
    if (typeof data.systemPrompt === 'string' && data.systemPrompt.trim()) {
      details.push(`   System prompt: ${data.systemPrompt.trim()}`);
    }
    if (typeof data.mode === 'string' && data.mode.trim()) {
      details.push(`   Trigger mode: ${data.mode.trim()}`);
    }
    if (typeof data.sendTo === 'string' && data.sendTo.trim()) {
      details.push(`   Email send to: ${data.sendTo.trim()}`);
    }
    if (typeof data.template === 'string' && data.template.trim()) {
      details.push(`   Template: ${data.template.trim()}`);
    }

    return details.join('\n');
  });

  const edgeLines = edges
    .filter((e) => e.source && e.target)
    .map((e) => `- ${e.source} → ${e.target}`);

  const parts = ['Langchain pipeline nodes:', ...nodeLines];
  if (edgeLines.length > 0) {
    parts.push('', 'Connections:', ...edgeLines);
  }
  return parts.join('\n');
}

export function resolveEvaluationTypePromptKey(
  assignmentType: string | undefined,
  mode: 'student_work' | 'teacher_review',
): string {
  if (mode === 'teacher_review') return 'eval_type_teacher_review';
  switch (assignmentType) {
    case 'test':
      return 'eval_type_test';
    case 'text_essay':
      return 'eval_type_essay';
    case 'langchain':
      return 'eval_type_langchain';
    case 'presentation':
      return 'eval_type_presentation';
    case 'project':
      return 'eval_type_project';
    default:
      return 'eval_type_conversation';
  }
}

export async function buildStudentWorkContext(
  supabase: SupabaseClient,
  submissionId: string,
  assignmentId: string,
  assignmentType: string | undefined,
): Promise<BuiltEvaluationContext> {
  if (assignmentType === 'test') {
    const [questionsResult, responsesResult] = await Promise.all([
      supabase
        .from('test_questions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('order_index', { ascending: true }),
      supabase
        .from('test_responses')
        .select('*')
        .eq('submission_id', submissionId),
    ]);

    const questions = questionsResult.data || [];
    const responses = responsesResult.data || [];

    if (questions.length === 0) {
      throw new Error('No test questions found for this assignment.');
    }

    const responseMap = new Map(responses.map((r: { question_id: string }) => [r.question_id, r]));

    const studentWorkText = questions.map((q: Record<string, unknown>, i: number) => {
      const response = responseMap.get(q.id as string) as Record<string, unknown> | undefined;
      const parts = [`Question ${i + 1} (${q.question_type}): ${q.question_text}`];

      if (q.question_type === 'multiple_choice' && q.options) {
        const options = q.options as { id: string; text: string }[];
        parts.push('Options: ' + options.map((o) => `${o.id}) ${o.text}`).join(', '));

        const correctIds = parseOptionIds(q.correct_option_ids, q.correct_option_id as string);
        if (correctIds.length > 0) {
          const correctLabels = optionLabelsForIds(options, correctIds);
          parts.push(
            correctIds.length > 1
              ? `Correct Answers: ${correctLabels.join('; ')}`
              : `Correct Answer: ${correctLabels[0]}`,
          );
        }

        const selectedIds = parseOptionIds(
          response?.selected_option_ids,
          response?.selected_option_id as string,
        );
        if (selectedIds.length > 0) {
          const selectedLabels = optionLabelsForIds(options, selectedIds);
          parts.push(
            selectedIds.length > 1
              ? `Student Answers: ${selectedLabels.join('; ')}`
              : `Student Answer: ${selectedLabels[0]}`,
          );
        } else {
          parts.push('Student Answer: No answer');
        }
      } else {
        parts.push(`Student Answer: ${response?.text_answer || 'No answer'}`);
      }

      return parts.join('\n');
    }).join('\n\n');

    return {
      studentWorkText,
      conversationMessages: [
        { role: 'user', content: `Test submission with ${questions.length} questions` },
      ],
      inputKind: 'test',
      contextLabel: 'test responses',
    };
  }

  if (assignmentType === 'text_essay') {
    const { data: subRow, error: subErr } = await supabase
      .from('submissions')
      .select('text_body')
      .eq('id', submissionId)
      .single();

    if (subErr || !subRow?.text_body?.trim()) {
      throw new Error(
        'No essay text found for this submission. Please write your essay before submitting.',
      );
    }

    const body = subRow.text_body.trim();
    return {
      studentWorkText: `Essay submission:\n\n${body}`,
      conversationMessages: [{ role: 'user', content: body }],
      inputKind: 'essay',
      contextLabel: 'essay',
    };
  }

  if (assignmentType === 'langchain') {
    const { data: subRow, error: subErr } = await supabase
      .from('submissions')
      .select('text_body')
      .eq('id', submissionId)
      .single();

    if (subErr || !subRow?.text_body?.trim()) {
      throw new Error('No langchain pipeline found for this submission.');
    }

    const pipelineText = formatLangchainPipelineText(subRow.text_body.trim());
    return {
      studentWorkText: pipelineText,
      conversationMessages: [{ role: 'user', content: pipelineText }],
      inputKind: 'artifact',
      contextLabel: 'langchain pipeline',
    };
  }

  if (assignmentType === 'presentation') {
    const { data: subRow, error: subErr } = await supabase
      .from('submissions')
      .select('artifact_transcript')
      .eq('id', submissionId)
      .single();

    if (subErr) {
      throw new Error('Failed to load submission for presentation evaluation.');
    }

    const transcript = await ensurePresentationTranscript(
      supabase,
      submissionId,
      assignmentId,
      subRow?.artifact_transcript,
    );

    const studentWorkText = `Presentation transcript:\n\n${transcript}`;
    return {
      studentWorkText,
      conversationMessages: [{ role: 'user', content: transcript }],
      inputKind: 'artifact',
      contextLabel: 'presentation transcript',
    };
  }

  if (assignmentType === 'project') {
    const { data: subRow, error: subErr } = await supabase
      .from('submissions')
      .select('file_urls, file_url, artifact_transcript')
      .eq('id', submissionId)
      .single();

    if (subErr) {
      throw new Error('Failed to load submission for project evaluation.');
    }

    const extracted = await ensureProjectFilesTranscript(
      supabase,
      submissionId,
      subRow?.file_urls,
      subRow?.file_url,
      subRow?.artifact_transcript,
    );

    const studentWorkText = `Project files:\n\n${extracted}`;
    return {
      studentWorkText,
      conversationMessages: [{ role: 'user', content: extracted }],
      inputKind: 'artifact',
      contextLabel: 'project files',
    };
  }

  const { data: conversations, error: convError } = await supabase
    .from('assignment_conversations')
    .select('*')
    .eq('submission_id', submissionId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (convError || !conversations || conversations.length === 0) {
    throw new Error(
      'No conversation found for this submission. Please chat with Perleap before completing.',
    );
  }

  const conversation = conversations[0];

  if (!conversation.messages || conversation.messages.length === 0) {
    throw new Error('No conversation messages found. Please chat with Perleap first.');
  }

  const messages = conversation.messages as Array<{ role: string; content: string }>;
  const studentWorkText = messages
    .map((msg) => `${msg.role === 'user' ? 'Student' : 'Agent'}: ${msg.content}`)
    .join('\n\n');

  return {
    studentWorkText,
    conversationMessages: messages,
    inputKind: 'conversation',
    contextLabel: 'conversation',
  };
}

export function detectLanguageFromText(text: string, fallback = 'en'): string {
  const hebrewPattern = /[\u0590-\u05FF]/;
  return hebrewPattern.test(text) ? 'he' : fallback;
}
