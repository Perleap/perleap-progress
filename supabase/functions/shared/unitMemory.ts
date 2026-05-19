/**
 * Per-student memory helpers: unit (syllabus section) and course (classroom-wide).
 *
 * Unit facts power `<unit_memory>`; course facts power `<course_memory>` for cross-unit recall.
 */

import { createSupabaseClient } from './supabase.ts';
import { hasKeywordOverlap } from '../_shared/topicOverlap.ts';

export interface UnitMemoryFact {
  id: string;
  submission_id: string;
  assignment_id: string;
  assignment_title: string;
  text: string;
  extracted_at: string;
}

export interface UnitMemoryRow {
  id: string;
  student_id: string;
  classroom_id: string;
  syllabus_section_id: string;
  facts: UnitMemoryFact[];
}

/** Course-scoped fact with unit provenance for cross-unit recall. */
export interface CourseMemoryFact extends UnitMemoryFact {
  syllabus_section_id: string;
  syllabus_section_title?: string;
}

export interface CourseMemoryRow {
  id: string;
  student_id: string;
  classroom_id: string;
  facts: CourseMemoryFact[];
  processed_submission_ids: string[];
}

const DEFAULT_MAX_FACTS = 20;
const DEFAULT_PROMPT_CAP = 8;
const DEFAULT_COURSE_MAX_FACTS = 60;
const DEFAULT_COURSE_PROMPT_CAP = 12;

export function isUnitMemoryEnabled(): boolean {
  return (Deno.env.get('PERLEAP_UNIT_MEMORY_ENABLED') ?? 'true') !== 'false';
}

export function maxUnitMemoryFactsStored(): number {
  const n = parseInt(Deno.env.get('PERLEAP_UNIT_MEMORY_MAX_FACTS') ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_FACTS;
}

export function unitMemoryPromptCap(): number {
  const n = parseInt(Deno.env.get('PERLEAP_UNIT_MEMORY_PROMPT_CAP') ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PROMPT_CAP;
}

export function isCourseMemoryEnabled(): boolean {
  return (Deno.env.get('PERLEAP_COURSE_MEMORY_ENABLED') ?? 'true') !== 'false';
}

export function maxCourseMemoryFactsStored(): number {
  const n = parseInt(Deno.env.get('PERLEAP_COURSE_MEMORY_MAX_FACTS') ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_COURSE_MAX_FACTS;
}

export function courseMemoryPromptCap(): number {
  const n = parseInt(Deno.env.get('PERLEAP_COURSE_MEMORY_PROMPT_CAP') ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_COURSE_PROMPT_CAP;
}

/** Normalize a fact line for deduplication. */
export function fingerprintFact(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?,;:]+\s*$/g, '')
    .trim()
    .slice(0, 48);
}

function parseFactsJson(raw: unknown): UnitMemoryFact[] {
  if (!Array.isArray(raw)) return [];
  const out: UnitMemoryFact[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const text = typeof o.text === 'string' ? o.text.trim() : '';
    const submissionId = typeof o.submission_id === 'string' ? o.submission_id.trim() : '';
    if (!text || !submissionId) continue;
    out.push({
      id: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : crypto.randomUUID(),
      submission_id: submissionId,
      assignment_id: typeof o.assignment_id === 'string' ? o.assignment_id : '',
      assignment_title: typeof o.assignment_title === 'string' ? o.assignment_title : '',
      text: text.slice(0, 200),
      extracted_at: typeof o.extracted_at === 'string' ? o.extracted_at : new Date().toISOString(),
    });
  }
  return out;
}

function parseCourseFactsJson(raw: unknown): CourseMemoryFact[] {
  if (!Array.isArray(raw)) return [];
  const out: CourseMemoryFact[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const text = typeof o.text === 'string' ? o.text.trim() : '';
    const submissionId = typeof o.submission_id === 'string' ? o.submission_id.trim() : '';
    const sectionId = typeof o.syllabus_section_id === 'string' ? o.syllabus_section_id.trim() : '';
    if (!text || !submissionId || !sectionId) continue;
    out.push({
      id: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : crypto.randomUUID(),
      submission_id: submissionId,
      assignment_id: typeof o.assignment_id === 'string' ? o.assignment_id : '',
      assignment_title: typeof o.assignment_title === 'string' ? o.assignment_title : '',
      text: text.slice(0, 200),
      extracted_at: typeof o.extracted_at === 'string' ? o.extracted_at : new Date().toISOString(),
      syllabus_section_id: sectionId,
      syllabus_section_title:
        typeof o.syllabus_section_title === 'string' ? o.syllabus_section_title : undefined,
    });
  }
  return out;
}

function parseProcessedSubmissionIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) out.push(item.trim());
  }
  return out;
}

export interface MergeFactsOptions {
  maxFacts?: number;
  /** When set, replace any existing facts from this submission before merging. */
  submissionId?: string;
}

/**
 * Merge incoming facts into existing array: drop old facts for the same submission_id,
 * dedupe by fingerprint, keep newest-first, cap total length.
 */
export function mergeFacts(
  existing: UnitMemoryFact[],
  incoming: UnitMemoryFact[],
  opts: MergeFactsOptions = {},
): UnitMemoryFact[] {
  const maxFacts = opts.maxFacts ?? maxUnitMemoryFactsStored();
  const submissionId = opts.submissionId?.trim();

  let base = existing;
  if (submissionId) {
    base = existing.filter((f) => f.submission_id !== submissionId);
  }

  const seen = new Set(base.map((f) => fingerprintFact(f.text)));
  const merged = [...base];

  for (const fact of incoming) {
    const fp = fingerprintFact(fact.text);
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    merged.push(fact);
  }

  // Ensure this submission is represented (idempotency marker + recall) even when
  // all incoming bullets dedupe against existing facts in a full unit.
  if (submissionId && incoming.length > 0) {
    const hasSubmissionFacts = merged.some((f) => f.submission_id === submissionId);
    if (!hasSubmissionFacts) {
      const primary =
        incoming.find((f) => f.submission_id === submissionId) ?? incoming[0];
      merged.push({ ...primary, submission_id: submissionId });
    }
  }

  // Newest extraction batches first (by extracted_at desc).
  merged.sort((a, b) => String(b.extracted_at).localeCompare(String(a.extracted_at)));

  return merged.slice(0, maxFacts);
}

export async function getUnitMemoryRow(
  studentId: string,
  classroomId: string,
  syllabusSectionId: string,
): Promise<UnitMemoryRow | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from('student_section_unit_memory')
    .select('id, student_id, classroom_id, syllabus_section_id, facts')
    .eq('student_id', studentId)
    .eq('classroom_id', classroomId)
    .eq('syllabus_section_id', syllabusSectionId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    student_id: data.student_id,
    classroom_id: data.classroom_id,
    syllabus_section_id: data.syllabus_section_id,
    facts: parseFactsJson(data.facts),
  };
}

export async function hasFactsForSubmission(
  studentId: string,
  classroomId: string,
  syllabusSectionId: string,
  submissionId: string,
): Promise<boolean> {
  const row = await getUnitMemoryRow(studentId, classroomId, syllabusSectionId);
  if (!row) return false;
  return row.facts.some((f) => f.submission_id === submissionId);
}

export async function upsertUnitMemoryFacts(params: {
  studentId: string;
  classroomId: string;
  syllabusSectionId: string;
  incomingFacts: UnitMemoryFact[];
  submissionId: string;
}): Promise<{ factCount: number }> {
  const { studentId, classroomId, syllabusSectionId, incomingFacts, submissionId } = params;
  const supabase = createSupabaseClient();

  const existing = await getUnitMemoryRow(studentId, classroomId, syllabusSectionId);
  const merged = mergeFacts(existing?.facts ?? [], incomingFacts, {
    submissionId,
    maxFacts: maxUnitMemoryFactsStored(),
  });

  if (existing) {
    const { error } = await supabase
      .from('student_section_unit_memory')
      .update({ facts: merged })
      .eq('id', existing.id);
    if (error) throw new Error(`Failed to update unit memory: ${error.message}`);
  } else {
    const { error } = await supabase.from('student_section_unit_memory').insert({
      student_id: studentId,
      classroom_id: classroomId,
      syllabus_section_id: syllabusSectionId,
      facts: merged,
    });
    if (error) throw new Error(`Failed to insert unit memory: ${error.message}`);
  }

  return { factCount: merged.length };
}

/** Format facts as a bullet list for the `<unit_memory>` prompt block. */
export function formatUnitMemoryBody(facts: UnitMemoryFact[]): string {
  if (!facts.length) return '';
  return facts
    .map((f) => {
      const title = f.assignment_title?.trim();
      const prefix = title ? `[${title}] ` : '';
      return `- ${prefix}${f.text.trim()}`;
    })
    .join('\n');
}

/**
 * Load topic-relevant unit memory for the current assignment, excluding facts from
 * the current submission when `currentSubmissionId` is provided.
 */
export async function getUnitMemoryForPrompt(
  studentId: string,
  assignmentId: string,
  assignmentTutorText: string,
  currentSubmissionId?: string,
): Promise<{ body: string; factCount: number }> {
  if (!isUnitMemoryEnabled()) {
    return { body: '', factCount: 0 };
  }

  const supabase = createSupabaseClient();
  const { data: assignment, error } = await supabase
    .from('assignments')
    .select('classroom_id, syllabus_section_id')
    .eq('id', assignmentId)
    .maybeSingle();

  if (error || !assignment?.classroom_id || !assignment.syllabus_section_id) {
    return { body: '', factCount: 0 };
  }

  const row = await getUnitMemoryRow(
    studentId,
    assignment.classroom_id,
    assignment.syllabus_section_id,
  );
  if (!row || row.facts.length === 0) {
    return { body: '', factCount: 0 };
  }

  let facts = row.facts;
  if (currentSubmissionId) {
    facts = facts.filter((f) => f.submission_id !== currentSubmissionId);
  }
  // Exclude facts from the current assignment (only earlier work in the unit).
  facts = facts.filter((f) => f.assignment_id !== assignmentId);

  if (assignmentTutorText.trim() && facts.length > 0) {
    facts = facts.filter((f) => hasKeywordOverlap(f.text, assignmentTutorText));
  }

  const cap = unitMemoryPromptCap();
  facts = facts.slice(0, cap);

  const body = formatUnitMemoryBody(facts);
  return { body, factCount: facts.length };
}

export async function getCourseMemoryRow(
  studentId: string,
  classroomId: string,
): Promise<CourseMemoryRow | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from('student_classroom_course_memory')
    .select('id, student_id, classroom_id, facts, processed_submission_ids')
    .eq('student_id', studentId)
    .eq('classroom_id', classroomId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    student_id: data.student_id,
    classroom_id: data.classroom_id,
    facts: parseCourseFactsJson(data.facts),
    processed_submission_ids: parseProcessedSubmissionIds(data.processed_submission_ids),
  };
}

export async function hasProcessedSubmission(
  studentId: string,
  classroomId: string,
  submissionId: string,
): Promise<boolean> {
  const row = await getCourseMemoryRow(studentId, classroomId);
  if (!row) return false;
  return row.processed_submission_ids.includes(submissionId);
}

export async function markSubmissionProcessed(
  studentId: string,
  classroomId: string,
  submissionId: string,
): Promise<void> {
  const supabase = createSupabaseClient();
  const existing = await getCourseMemoryRow(studentId, classroomId);
  const ids = existing?.processed_submission_ids ?? [];
  if (ids.includes(submissionId)) return;

  const nextIds = [...ids, submissionId];
  if (existing) {
    const { error } = await supabase
      .from('student_classroom_course_memory')
      .update({ processed_submission_ids: nextIds })
      .eq('id', existing.id);
    if (error) throw new Error(`Failed to mark submission processed: ${error.message}`);
  } else {
    const { error } = await supabase.from('student_classroom_course_memory').insert({
      student_id: studentId,
      classroom_id: classroomId,
      facts: [],
      processed_submission_ids: nextIds,
    });
    if (error) throw new Error(`Failed to insert course memory row: ${error.message}`);
  }
}

export async function upsertCourseMemoryFacts(params: {
  studentId: string;
  classroomId: string;
  incomingFacts: CourseMemoryFact[];
  submissionId: string;
  markProcessed?: boolean;
}): Promise<{ factCount: number }> {
  const { studentId, classroomId, incomingFacts, submissionId, markProcessed = true } = params;
  const supabase = createSupabaseClient();

  const existing = await getCourseMemoryRow(studentId, classroomId);
  const merged = mergeFacts(
    (existing?.facts ?? []) as UnitMemoryFact[],
    incomingFacts,
    {
      submissionId,
      maxFacts: maxCourseMemoryFactsStored(),
    },
  ) as CourseMemoryFact[];

  const processedIds = new Set(existing?.processed_submission_ids ?? []);
  if (markProcessed) processedIds.add(submissionId);

  if (existing) {
    const { error } = await supabase
      .from('student_classroom_course_memory')
      .update({
        facts: merged,
        processed_submission_ids: [...processedIds],
      })
      .eq('id', existing.id);
    if (error) throw new Error(`Failed to update course memory: ${error.message}`);
  } else {
    const { error } = await supabase.from('student_classroom_course_memory').insert({
      student_id: studentId,
      classroom_id: classroomId,
      facts: merged,
      processed_submission_ids: [...processedIds],
    });
    if (error) throw new Error(`Failed to insert course memory: ${error.message}`);
  }

  return { factCount: merged.length };
}

/** Format course facts with unit + assignment provenance. */
export function formatCourseMemoryBody(facts: CourseMemoryFact[]): string {
  if (!facts.length) return '';
  return facts
    .map((f) => {
      const unit = f.syllabus_section_title?.trim();
      const title = f.assignment_title?.trim();
      const prefix =
        unit && title ? `[${unit} · ${title}] ` : unit ? `[${unit}] ` : title ? `[${title}] ` : '';
      return `- ${prefix}${f.text.trim()}`;
    })
    .join('\n');
}

/**
 * Cross-unit memory for the current assignment: facts from other syllabus sections in this classroom.
 */
export async function getCourseMemoryForPrompt(
  studentId: string,
  assignmentId: string,
  assignmentTutorText: string,
  currentSubmissionId?: string,
  userMessageForOverlap?: string,
  courseRecallMode?: boolean,
): Promise<{ body: string; factCount: number }> {
  if (!isCourseMemoryEnabled()) {
    return { body: '', factCount: 0 };
  }

  const supabase = createSupabaseClient();
  const { data: assignment, error } = await supabase
    .from('assignments')
    .select('classroom_id, syllabus_section_id, use_course_memory')
    .eq('id', assignmentId)
    .maybeSingle();

  if (error || !assignment?.classroom_id || !assignment.syllabus_section_id) {
    return { body: '', factCount: 0 };
  }
  if (assignment.use_course_memory === false) {
    return { body: '', factCount: 0 };
  }

  const row = await getCourseMemoryRow(studentId, assignment.classroom_id);
  if (!row || row.facts.length === 0) {
    return { body: '', factCount: 0 };
  }

  const currentSectionId = assignment.syllabus_section_id;

  let facts = row.facts.filter((f) => f.syllabus_section_id !== currentSectionId);

  if (currentSubmissionId) {
    facts = facts.filter((f) => f.submission_id !== currentSubmissionId);
  }
  facts = facts.filter((f) => f.assignment_id !== assignmentId);

  if (facts.length > 0 && !courseRecallMode) {
    const assignmentRef = assignmentTutorText.trim();
    const userRef = userMessageForOverlap?.trim() ?? '';
    if (assignmentRef || userRef) {
      facts = facts.filter(
        (f) =>
          (assignmentRef && hasKeywordOverlap(f.text, assignmentRef)) ||
          (userRef && hasKeywordOverlap(f.text, userRef)),
      );
    }
  }

  facts.sort((a, b) => String(b.extracted_at).localeCompare(String(a.extracted_at)));
  facts = facts.slice(0, courseMemoryPromptCap());

  const body = formatCourseMemoryBody(facts);
  return {
    body,
    factCount: facts.length,
  };
}

/** Promote section unit facts for one submission into the course row (no OpenAI). */
export async function promoteSectionFactsToCourse(params: {
  studentId: string;
  classroomId: string;
  syllabusSectionId: string;
  syllabusSectionTitle?: string;
  submissionId: string;
}): Promise<{ promoted: number }> {
  const sectionRow = await getUnitMemoryRow(
    params.studentId,
    params.classroomId,
    params.syllabusSectionId,
  );
  if (!sectionRow) return { promoted: 0 };

  const sectionFacts = sectionRow.facts.filter((f) => f.submission_id === params.submissionId);
  if (sectionFacts.length === 0) return { promoted: 0 };

  const courseFacts: CourseMemoryFact[] = sectionFacts.map((f) => ({
    ...f,
    syllabus_section_id: params.syllabusSectionId,
    syllabus_section_title: params.syllabusSectionTitle,
  }));

  await upsertCourseMemoryFacts({
    studentId: params.studentId,
    classroomId: params.classroomId,
    incomingFacts: courseFacts,
    submissionId: params.submissionId,
  });

  return { promoted: courseFacts.length };
}
