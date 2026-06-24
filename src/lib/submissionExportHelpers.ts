import type { Message } from '@/types';

export type SubmissionStudentWorkExport =
  | { type: 'chat'; messages: Message[] }
  | { type: 'text_essay'; text_body: string | null }
  | { type: 'test'; questions: Record<string, unknown>[]; responses: Record<string, unknown>[] }
  | { type: 'project'; file_url: string | null; file_urls: string[] | null; artifact_transcript: string | null }
  | { type: 'presentation'; file_url: string | null; artifact_transcript: string | null }
  | { type: 'langchain'; pipeline: unknown };

type StudentWorkExtras = {
  messages?: Message[] | null;
  testQuestions?: Record<string, unknown>[];
  testResponses?: Record<string, unknown>[];
};

export function sanitizeExportFilenamePart(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 48) || 'export'
  );
}

export function buildSubmissionExportFilename(assignmentTitle: string, studentName: string): string {
  const date = new Date().toISOString().split('T')[0];
  const assignment = sanitizeExportFilenamePart(assignmentTitle);
  const student = sanitizeExportFilenamePart(studentName);
  return `${assignment}-${student}-${date}.json`;
}

export function downloadJsonFile(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function parseLangchainPipeline(textBody: string | null): unknown {
  if (!textBody?.trim()) return null;
  try {
    return JSON.parse(textBody) as unknown;
  } catch {
    return textBody;
  }
}

export function buildStudentWorkExport(
  assignmentType: string,
  submission: {
    text_body?: string | null;
    file_url?: string | null;
    file_urls?: string[] | null;
    artifact_transcript?: string | null;
  },
  extras: StudentWorkExtras = {},
  feedbackConversationContext?: Message[] | null,
): SubmissionStudentWorkExport {
  if (assignmentType === 'text_essay') {
    return { type: 'text_essay', text_body: submission.text_body ?? null };
  }

  if (assignmentType === 'test') {
    return {
      type: 'test',
      questions: extras.testQuestions ?? [],
      responses: extras.testResponses ?? [],
    };
  }

  if (assignmentType === 'project') {
    return {
      type: 'project',
      file_url: submission.file_url ?? null,
      file_urls: submission.file_urls ?? null,
      artifact_transcript: submission.artifact_transcript ?? null,
    };
  }

  if (assignmentType === 'presentation') {
    return {
      type: 'presentation',
      file_url: submission.file_url ?? null,
      artifact_transcript: submission.artifact_transcript ?? null,
    };
  }

  if (assignmentType === 'langchain') {
    return { type: 'langchain', pipeline: parseLangchainPipeline(submission.text_body ?? null) };
  }

  const messages =
    extras.messages && extras.messages.length > 0
      ? extras.messages
      : feedbackConversationContext ?? [];

  return { type: 'chat', messages };
}
