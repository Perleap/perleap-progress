import { describe, expect, it } from 'vitest';
import {
  assembleClassroomStudentWorkEntries,
  buildClassroomStudentWorkFilename,
  buildStudentWorkExport,
  buildSubmissionExportFilename,
  parseLangchainPipeline,
  sanitizeExportFilenamePart,
  slimMessagesForExport,
  type ClassroomSubmissionWorkRow,
} from '@/lib/submissionExportHelpers';
import type { Message } from '@/types';

describe('slimMessagesForExport', () => {
  it('keeps role, content, and fileContext only', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: 'Hello',
        raw_model_text: 'raw',
        openai_chat_request_snapshot: { model: 'gpt-4' },
        opik_client_trace_id: 'trace-1',
      },
      {
        role: 'user',
        content: 'Hi',
        fileContext: { name: 'doc.pdf', content: 'body', type: 'pdf' },
      },
    ];

    expect(slimMessagesForExport(messages)).toEqual([
      { role: 'assistant', content: 'Hello' },
      {
        role: 'user',
        content: 'Hi',
        fileContext: { name: 'doc.pdf', content: 'body', type: 'pdf' },
      },
    ]);
  });
});

describe('buildClassroomStudentWorkFilename', () => {
  it('uses classroom name when provided', () => {
    expect(buildClassroomStudentWorkFilename('My Class')).toMatch(/^My-Class-student-work-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('falls back to generic name', () => {
    expect(buildClassroomStudentWorkFilename()).toMatch(/^classroom-student-work-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe('assembleClassroomStudentWorkEntries', () => {
  const baseRow: ClassroomSubmissionWorkRow = {
    id: 'sub-1',
    student_id: 'stu-1',
    student_name: 'Jane Doe',
    assignment_id: 'asg-1',
    assignment_title: 'Chat Task',
    assignment_type: 'chatbot',
    syllabus_section_id: null,
    status: 'completed',
    submitted_at: '2026-06-28T10:00:00.000Z',
    attempt_number: 1,
    text_body: null,
    file_url: null,
    file_urls: null,
    artifact_transcript: null,
  };

  it('uses live conversation messages for chat-like assignments', () => {
    const live: Message[] = [{ role: 'user', content: 'live', raw_model_text: 'strip-me' }];
    const conversations = new Map([['sub-1', live]]);

    const entries = assembleClassroomStudentWorkEntries(
      [baseRow],
      conversations,
      new Map(),
      new Map(),
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].student_work).toEqual({
      type: 'chat',
      messages: [{ role: 'user', content: 'live' }],
    });
  });

  it('returns empty chat messages when no conversation exists', () => {
    const entries = assembleClassroomStudentWorkEntries(
      [baseRow],
      new Map(),
      new Map(),
      new Map(),
    );

    expect(entries[0].student_work).toEqual({ type: 'chat', messages: [] });
  });

  it('includes test questions and responses for test assignments', () => {
    const testRow: ClassroomSubmissionWorkRow = {
      ...baseRow,
      id: 'sub-test',
      assignment_id: 'asg-test',
      assignment_type: 'test',
    };
    const questions = [{ id: 'q1', question_text: 'Q?' }];
    const responses = [{ question_id: 'q1', text_answer: 'A' }];
    const questionsByAssignment = new Map([['asg-test', questions]]);
    const responsesBySubmission = new Map([['sub-test', responses]]);

    const entries = assembleClassroomStudentWorkEntries(
      [testRow],
      new Map(),
      questionsByAssignment,
      responsesBySubmission,
    );

    expect(entries[0].student_work).toEqual({
      type: 'test',
      questions,
      responses,
    });
  });
});

describe('sanitizeExportFilenamePart', () => {
  it('strips unsafe characters and collapses whitespace', () => {
    expect(sanitizeExportFilenamePart('Essay: Part 1!')).toBe('Essay-Part-1');
  });

  it('falls back when empty after sanitization', () => {
    expect(sanitizeExportFilenamePart('!!!')).toBe('export');
  });
});

describe('buildSubmissionExportFilename', () => {
  it('combines assignment, student, and date', () => {
    const filename = buildSubmissionExportFilename('My Assignment', 'Jane Doe');
    expect(filename).toMatch(/^My-Assignment-Jane-Doe-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe('parseLangchainPipeline', () => {
  it('parses valid JSON', () => {
    expect(parseLangchainPipeline('{"nodes":[],"edges":[]}')).toEqual({ nodes: [], edges: [] });
  });

  it('returns raw string when JSON is invalid', () => {
    expect(parseLangchainPipeline('not-json')).toBe('not-json');
  });

  it('returns null for empty input', () => {
    expect(parseLangchainPipeline(null)).toBeNull();
    expect(parseLangchainPipeline('')).toBeNull();
  });
});

describe('buildStudentWorkExport', () => {
  const submission = {
    text_body: 'essay text',
    file_url: 'https://example.com/video.mp4',
    file_urls: ['https://example.com/a.pdf'],
    artifact_transcript: 'transcript',
  };

  it('includes text_body for text_essay', () => {
    const work = buildStudentWorkExport('text_essay', submission);
    expect(work).toEqual({ type: 'text_essay', text_body: 'essay text' });
  });

  it('includes questions and responses for test', () => {
    const questions = [{ id: 'q1', question_text: 'Q?' }];
    const responses = [{ question_id: 'q1', text_answer: 'A' }];
    const work = buildStudentWorkExport('test', submission, { testQuestions: questions, testResponses: responses });
    expect(work).toEqual({ type: 'test', questions, responses });
  });

  it('includes file fields for project', () => {
    const work = buildStudentWorkExport('project', submission);
    expect(work).toEqual({
      type: 'project',
      file_url: submission.file_url,
      file_urls: submission.file_urls,
      artifact_transcript: submission.artifact_transcript,
    });
  });

  it('includes file fields for presentation', () => {
    const work = buildStudentWorkExport('presentation', submission);
    expect(work).toEqual({
      type: 'presentation',
      file_url: submission.file_url,
      artifact_transcript: submission.artifact_transcript,
    });
  });

  it('parses pipeline for langchain', () => {
    const work = buildStudentWorkExport('langchain', { text_body: '{"nodes":[]}' });
    expect(work).toEqual({ type: 'langchain', pipeline: { nodes: [] } });
  });

  it('prefers live conversation over feedback snapshot for chat types', () => {
    const live: Message[] = [{ role: 'user', content: 'live' }];
    const snapshot: Message[] = [{ role: 'user', content: 'snapshot' }];
    const work = buildStudentWorkExport('chatbot', submission, { messages: live }, snapshot);
    expect(work).toEqual({ type: 'chat', messages: live });
  });

  it('falls back to feedback snapshot when live conversation is empty', () => {
    const snapshot: Message[] = [{ role: 'assistant', content: 'snapshot' }];
    const work = buildStudentWorkExport('questions', submission, { messages: [] }, snapshot);
    expect(work).toEqual({ type: 'chat', messages: snapshot });
  });
});
