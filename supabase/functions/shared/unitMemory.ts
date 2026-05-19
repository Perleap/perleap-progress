/**
 * Per-student, per-syllabus-section unit memory helpers.
 *
 * Facts are extracted after assignment completion and injected into perleap-chat
 * as a distilled `<unit_memory>` block (proactive recall, topic-filtered).
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

const DEFAULT_MAX_FACTS = 20;
const DEFAULT_PROMPT_CAP = 8;

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
