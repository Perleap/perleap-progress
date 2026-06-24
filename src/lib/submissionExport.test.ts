import { describe, expect, it } from 'vitest';
import {
  buildStudentWorkExport,
  buildSubmissionExportFilename,
  parseLangchainPipeline,
  sanitizeExportFilenamePart,
} from '@/lib/submissionExportHelpers';
import type { Message } from '@/types';

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
