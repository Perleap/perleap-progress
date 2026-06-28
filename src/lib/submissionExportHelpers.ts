import type { Message } from '@/types';
import { isChatLikeAssignmentType } from '@/lib/assignmentChatLike';

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

export type ExportMessage = Pick<Message, 'role' | 'content' | 'fileContext'>;

export type ClassroomSubmissionWorkRow = {
  id: string;
  student_id: string;
  student_name: string;
  assignment_id: string;
  assignment_title: string;
  assignment_type: string;
  status: string;
  submitted_at: string;
  attempt_number: number;
  text_body: string | null;
  file_url: string | null;
  file_urls: string[] | null;
  artifact_transcript: string | null;
};

export type ClassroomStudentWorkEntry = {
  submission_id: string;
  student: { id: string; name: string };
  assignment: { id: string; title: string; type: string };
  submitted_at: string;
  status: string;
  attempt_number: number;
  student_work: SubmissionStudentWorkExport;
};

export function slimMessagesForExport(messages: Message[]): ExportMessage[] {
  return messages.map((msg) => {
    const slim: ExportMessage = { role: msg.role, content: msg.content };
    if (msg.fileContext) {
      slim.fileContext = msg.fileContext;
    }
    return slim;
  });
}

function slimStudentWorkExport(work: SubmissionStudentWorkExport): SubmissionStudentWorkExport {
  if (work.type !== 'chat') return work;
  return { type: 'chat', messages: slimMessagesForExport(work.messages) as Message[] };
}

export function assembleClassroomStudentWorkEntries(
  rows: ClassroomSubmissionWorkRow[],
  conversationsBySubmissionId: Map<string, Message[]>,
  questionsByAssignmentId: Map<string, Record<string, unknown>[]>,
  responsesBySubmissionId: Map<string, Record<string, unknown>[]>,
): ClassroomStudentWorkEntry[] {
  return rows.map((row) => {
    const assignmentType = row.assignment_type;
    const isChatLike = isChatLikeAssignmentType(assignmentType);
    const messages = isChatLike ? (conversationsBySubmissionId.get(row.id) ?? null) : null;

    const studentWork = buildStudentWorkExport(
      assignmentType,
      {
        text_body: row.text_body,
        file_url: row.file_url,
        file_urls: row.file_urls,
        artifact_transcript: row.artifact_transcript,
      },
      {
        messages,
        testQuestions: questionsByAssignmentId.get(row.assignment_id) ?? [],
        testResponses: responsesBySubmissionId.get(row.id) ?? [],
      },
    );

    return {
      submission_id: row.id,
      student: { id: row.student_id, name: row.student_name },
      assignment: {
        id: row.assignment_id,
        title: row.assignment_title,
        type: assignmentType,
      },
      submitted_at: row.submitted_at,
      status: row.status,
      attempt_number: row.attempt_number,
      student_work: slimStudentWorkExport(studentWork),
    };
  });
}

export function buildClassroomStudentWorkFilename(classroomName?: string | null): string {
  const date = new Date().toISOString().split('T')[0];
  if (classroomName?.trim()) {
    const slug = sanitizeExportFilenamePart(classroomName);
    return `${slug}-student-work-${date}.json`;
  }
  return `classroom-student-work-${date}.json`;
}
