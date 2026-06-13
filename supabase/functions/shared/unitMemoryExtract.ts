/**
 * Core unit-memory extraction logic shared by extract-unit-memory and backfill-unit-memory.
 */

import { createSupabaseClient } from './supabase.ts';
import { optionLabelsForIds, parseOptionIds } from './testMcq.ts';
import { createChatCompletion, resolveChatModel } from './openai.ts';
import {
  hasFactsForSubmission,
  hasProcessedSubmission,
  markSubmissionProcessed,
  promoteSectionFactsToCourse,
  type CourseMemoryFact,
  type UnitMemoryFact,
  upsertCourseMemoryFacts,
  upsertUnitMemoryFacts,
} from './unitMemory.ts';
import { queueOpikTrace } from './opikTrace.ts';

export interface ExtractUnitMemoryResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  factsExtracted?: number;
  totalFacts?: number;
  courseFactsExtracted?: number;
  totalCourseFacts?: number;
  submissionId: string;
  error?: string;
}

const MAX_SOURCE_CHARS = 12_000;

function stripHiddenMarkers(text: string): string {
  return text
    .replace(/\[CONVERSATION_COMPLETE\]/gi, '')
    .replace(/<<<PROGRESS:\[[^\]]*\]>>>/g, '')
    .trim();
}

/** Build plain-text source from a completed submission for fact extraction. */
export async function buildSubmissionSourceText(
  submissionId: string,
  assignmentId: string,
  assignmentType: string | null | undefined,
): Promise<string | null> {
  const supabase = createSupabaseClient();

  if (assignmentType === 'test') {
    const [questionsResult, responsesResult] = await Promise.all([
      supabase
        .from('test_questions')
        .select('id, question_text, question_type, options, correct_option_id, correct_option_ids')
        .eq('assignment_id', assignmentId)
        .order('order_index', { ascending: true }),
      supabase
        .from('test_responses')
        .select('question_id, selected_option_id, selected_option_ids, text_answer')
        .eq('submission_id', submissionId),
    ]);

    const questions = questionsResult.data ?? [];
    const responses = responsesResult.data ?? [];
    if (questions.length === 0) return null;

    const responseMap = new Map(responses.map((r) => [r.question_id, r]));
    const lines: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const response = responseMap.get(q.id);
      const qtext = (q.question_text ?? 'Question').trim();
      lines.push(`Question ${i + 1}: ${qtext}`);

      const ta = typeof response?.text_answer === 'string' ? response.text_answer.trim() : '';
      if (ta) {
        lines.push(`Student answer: ${ta}`);
        continue;
      }

      const selectedIds = parseOptionIds(
        response?.selected_option_ids,
        response?.selected_option_id,
      );
      if (selectedIds.length > 0 && Array.isArray(q.options)) {
        const opts = q.options as { id?: unknown; text?: unknown }[];
        const normalizedOptions = opts.map((o) => ({
          id: String(o?.id ?? ''),
          text: typeof o?.text === 'string' ? o.text : String(o?.id ?? ''),
        }));
        const labels = optionLabelsForIds(normalizedOptions, selectedIds);
        lines.push(`Student selected: ${labels.join('; ')}`);
      }
    }

    return lines.join('\n').slice(0, MAX_SOURCE_CHARS) || null;
  }

  if (assignmentType === 'text_essay') {
    const { data: subRow } = await supabase
      .from('submissions')
      .select('text_body')
      .eq('id', submissionId)
      .maybeSingle();
    const body = typeof subRow?.text_body === 'string' ? subRow.text_body.trim() : '';
    if (!body) return null;
    return `Essay submission:\n\n${body}`.slice(0, MAX_SOURCE_CHARS);
  }

  // Default: conversation-based assignment
  const { data: convRows } = await supabase
    .from('assignment_conversations')
    .select('messages')
    .eq('submission_id', submissionId)
    .order('updated_at', { ascending: false })
    .limit(1);

  const raw = convRows?.[0]?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const lines: string[] = [];
  for (const msg of raw) {
    if (!msg || typeof msg !== 'object') continue;
    const m = msg as { role?: string; content?: unknown };
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (typeof m.content !== 'string') continue;
    const cleaned = stripHiddenMarkers(m.content);
    if (!cleaned || cleaned.length < 3) continue;
    const label = m.role === 'user' ? 'Student' : 'Assistant';
    lines.push(`${label}: ${cleaned}`);
  }

  return lines.join('\n\n').slice(0, MAX_SOURCE_CHARS) || null;
}

function parseExtractionResponse(content: string): string[] {
  const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(cleaned) as { facts?: unknown };
  if (!Array.isArray(parsed.facts)) return [];
  const out: string[] = [];
  for (const item of parsed.facts) {
    if (typeof item === 'string') {
      const t = item.trim();
      if (t) out.push(t.slice(0, 200));
    } else if (item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string') {
      const t = (item as { text: string }).text.trim();
      if (t) out.push(t.slice(0, 200));
    }
  }
  return out.slice(0, 6);
}

const EXTRACTION_SYSTEM_PROMPT = `You extract durable factual memory bullets about a student's demonstrated work on an assignment.

Return JSON only:
{ "facts": ["...", "..."] }

Rules:
- Extract 3 to 6 bullets when there is enough signal; fewer if the submission is very short.
- Each bullet is one factual statement about what the STUDENT said, wrote, selected, or demonstrated.
- Include specific answers, sentences they wrote, and clear struggles when evident.
- Do NOT include tutor/assistant phrasing, grades, scores, or pedagogical framework terms.
- Do NOT include greetings or filler.
- Each bullet must be at most 200 characters.
- Write bullets in the same language as the student's main contributions.`;

async function resolveSectionTitle(syllabusSectionId: string): Promise<string> {
  const supabase = createSupabaseClient();
  const { data } = await supabase
    .from('syllabus_sections')
    .select('title')
    .eq('id', syllabusSectionId)
    .maybeSingle();
  return typeof data?.title === 'string' ? data.title.trim() : '';
}

/**
 * Extract and persist unit + course memory for one completed submission.
 */
export async function extractUnitMemoryFromSubmission(
  submissionId: string,
  opts: { skipIfExists?: boolean } = {},
): Promise<ExtractUnitMemoryResult> {
  const skipIfExists = opts.skipIfExists !== false;
  const supabase = createSupabaseClient();
  const startMs = Date.now();

  const { data: sub, error: subErr } = await supabase
    .from('submissions')
    .select('id, student_id, assignment_id, status, is_teacher_attempt, text_body')
    .eq('id', submissionId)
    .maybeSingle();

  if (subErr || !sub) {
    return { ok: false, submissionId, error: 'Submission not found' };
  }
  if (sub.is_teacher_attempt) {
    return { ok: true, skipped: true, reason: 'teacher_attempt', submissionId };
  }
  if (sub.status !== 'completed') {
    return { ok: true, skipped: true, reason: 'not_completed', submissionId };
  }

  const { data: assignment, error: aErr } = await supabase
    .from('assignments')
    .select('id, title, type, classroom_id, syllabus_section_id, use_course_memory')
    .eq('id', sub.assignment_id)
    .maybeSingle();

  if (aErr || !assignment) {
    return { ok: false, submissionId, error: 'Assignment not found' };
  }
  if (!assignment.classroom_id || !assignment.syllabus_section_id) {
    return { ok: true, skipped: true, reason: 'no_syllabus_section', submissionId };
  }

  const useCourseMemory = assignment.use_course_memory !== false;
  const sectionExists = await hasFactsForSubmission(
    sub.student_id,
    assignment.classroom_id,
    assignment.syllabus_section_id,
    submissionId,
  );
  const courseProcessed = useCourseMemory
    ? await hasProcessedSubmission(sub.student_id, assignment.classroom_id, submissionId)
    : true;

  if (skipIfExists && sectionExists && (!useCourseMemory || courseProcessed)) {
    return { ok: true, skipped: true, reason: 'already_extracted', submissionId };
  }

  // Section already extracted; promote to course without OpenAI.
  if (sectionExists && useCourseMemory && !courseProcessed) {
    const sectionTitle = await resolveSectionTitle(assignment.syllabus_section_id);
    const { promoted } = await promoteSectionFactsToCourse({
      studentId: sub.student_id,
      classroomId: assignment.classroom_id,
      syllabusSectionId: assignment.syllabus_section_id,
      syllabusSectionTitle: sectionTitle || undefined,
      submissionId,
    });
    if (promoted === 0) {
      await markSubmissionProcessed(sub.student_id, assignment.classroom_id, submissionId);
    }
    return {
      ok: true,
      submissionId,
      factsExtracted: 0,
      courseFactsExtracted: promoted,
      reason: 'promoted_from_section',
    };
  }

  const sourceText = await buildSubmissionSourceText(
    submissionId,
    sub.assignment_id,
    assignment.type,
  );
  if (!sourceText || sourceText.trim().length < 20) {
    if (useCourseMemory && !courseProcessed) {
      await markSubmissionProcessed(sub.student_id, assignment.classroom_id, submissionId);
    }
    return { ok: true, skipped: true, reason: 'insufficient_source', submissionId };
  }

  const userPrompt = `Assignment title: ${assignment.title ?? 'Untitled'}

Student work excerpt:
${sourceText}`;

  const traceStartMs = Date.now();
  let extractedTexts: string[] = [];
  let extractionUsage: unknown;

  try {
    const result = await createChatCompletion(
      EXTRACTION_SYSTEM_PROMPT,
      [{ role: 'user', content: userPrompt }],
      0.2,
      800,
      'fast',
      false,
      'json_object',
    ) as { content: string; usage?: unknown };
    extractedTexts = parseExtractionResponse(result.content);
    extractionUsage = result.usage;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, submissionId, error: msg };
  }

  if (extractedTexts.length === 0) {
    if (useCourseMemory && !courseProcessed) {
      await markSubmissionProcessed(sub.student_id, assignment.classroom_id, submissionId);
    }
    return { ok: true, skipped: true, reason: 'no_facts_extracted', submissionId };
  }

  const now = new Date().toISOString();
  const sectionTitle = await resolveSectionTitle(assignment.syllabus_section_id);

  const incomingFacts: UnitMemoryFact[] = extractedTexts.map((text) => ({
    id: crypto.randomUUID(),
    submission_id: submissionId,
    assignment_id: sub.assignment_id,
    assignment_title: assignment.title ?? '',
    text,
    extracted_at: now,
  }));

  let factCount = 0;
  if (!sectionExists) {
    const sectionResult = await upsertUnitMemoryFacts({
      studentId: sub.student_id,
      classroomId: assignment.classroom_id,
      syllabusSectionId: assignment.syllabus_section_id,
      incomingFacts,
      submissionId,
    });
    factCount = sectionResult.factCount;
  }

  let totalCourseFacts = 0;
  let courseFactsExtracted = 0;
  if (useCourseMemory && !courseProcessed) {
    const courseIncoming: CourseMemoryFact[] = incomingFacts.map((f) => ({
      ...f,
      syllabus_section_id: assignment.syllabus_section_id,
      syllabus_section_title: sectionTitle || undefined,
    }));
    const courseResult = await upsertCourseMemoryFacts({
      studentId: sub.student_id,
      classroomId: assignment.classroom_id,
      incomingFacts: courseIncoming,
      submissionId,
    });
    totalCourseFacts = courseResult.factCount;
    courseFactsExtracted = courseIncoming.length;
  }

  void queueOpikTrace({
    traceName: 'extract-unit-memory.extract',
    tags: ['extract-unit-memory', 'unit-memory', 'course-memory'],
    threadId: submissionId,
    traceStartMs,
    traceEndMs: Date.now(),
    userMessage: userPrompt.slice(0, 4000),
    assistantMessage: JSON.stringify({ facts: extractedTexts }),
    openaiUsage: extractionUsage,
    llmModel: resolveChatModel('fast'),
    metadata: {
      edge_function: 'extract-unit-memory',
      submission_id: submissionId,
      assignment_id: sub.assignment_id,
      student_id: sub.student_id,
      classroom_id: assignment.classroom_id,
      syllabus_section_id: assignment.syllabus_section_id,
      facts_extracted: extractedTexts.length,
      total_facts: factCount,
      course_facts_extracted: courseFactsExtracted,
      total_course_facts: totalCourseFacts,
      use_course_memory: useCourseMemory,
      duration_ms: Date.now() - startMs,
    },
  }).catch(() => undefined);

  return {
    ok: true,
    submissionId,
    factsExtracted: extractedTexts.length,
    totalFacts: factCount,
    courseFactsExtracted,
    totalCourseFacts,
  };
}
