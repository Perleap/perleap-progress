import type { Json } from '@/integrations/supabase/types';
import type { FiveDScores } from '@/types/models';
import type { AnalyticsAssignmentRef } from '@/lib/analyticsScope';
import { INCLUDE_TEACHER_5D_EVIDENCE } from '@/config/constants';

/**
 * Client-side evidence bundle for explain-analytics-5d. A server-side fetch + cap (service role)
 * is deferred until production shows the client string still exceeds EVIDENCE_MAX_TOTAL_CHARS
 * for typical classrooms, or cost limits require it.
 */
/** Total cap for the evidence block sent to the LLM (characters). */
export const EVIDENCE_MAX_TOTAL_CHARS = 10_000;
const MAX_STUDENT_FEEDBACK_CHARS = 600;
const MAX_TEACHER_NOTE_CHARS = 400;
const MAX_INSTRUCTIONS_CHARS = 600;
const MAX_SCORE_EXPL_PER_DIM = 400;
const MAX_CLASS_STUDENT_SAMPLE = 14;
const MAX_EXCERPT_BLOCKS = 32;

const DIMS = ['vision', 'values', 'thinking', 'connection', 'action'] as const;
export type FiveDDim = (typeof DIMS)[number];

/**
 * One in-scope "best" submission for evidence: student AI feedback and snapshot notes; optional
 * teacher note when `INCLUDE_TEACHER_5D_EVIDENCE` (or `includeTeacherNotes` in the builder).
 */
export type Analytics5dNarrativeRow = {
  studentId: string;
  studentName: string;
  assignmentId: string;
  assignmentTitle: string;
  sectionTitle: string;
  syllabusSectionId: string | null;
  submissionId: string;
  studentFeedback: string | null;
  /** Teacher-written note; only included in the LLM bundle when teacher notes are enabled. */
  teacherNote?: string | null;
  scoreExplanations: Partial<Record<keyof FiveDScores, string>> | null;
};

export function parseScoreExplanations(
  j: Json | null | undefined,
): Partial<Record<keyof FiveDScores, string>> | null {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
  const o = j as Record<string, unknown>;
  const out: Partial<Record<keyof FiveDScores, string>> = {};
  for (const k of DIMS) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) {
      (out as Record<string, string>)[k] = v.trim();
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function trimToMax(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + '…';
}

/** Small stable hash for React Query / cache keys (not cryptographic). */
export function hashEvidenceKey(evidenceText: string): string {
  let h = 5381;
  for (let i = 0; i < evidenceText.length; i++) {
    h = (h * 33) ^ evidenceText.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

export const EVIDENCE_SOURCE_NOTE =
  'student_ai_feedback+snapshot_explanations+assignment_summaries';

/** Tag line for the edge function; reflects optional teacher notes when that channel is on. */
export function evidenceSourceNoteForBundle(includeTeacherNotes: boolean): string {
  return includeTeacherNotes
    ? `${EVIDENCE_SOURCE_NOTE}+optional_teacher_notes`
    : EVIDENCE_SOURCE_NOTE;
}

function rowHasText(r: Analytics5dNarrativeRow, includeTeacherNotes: boolean): boolean {
  if (includeTeacherNotes) {
    const tn = (r.teacherNote && r.teacherNote.trim()) || '';
    if (tn.length > 0) return true;
  }
  const fb = (r.studentFeedback && r.studentFeedback.trim()) || '';
  if (fb.length > 0) return true;
  const se = r.scoreExplanations;
  if (!se) return false;
  return DIMS.some((d) => (se[d] && se[d]!.trim().length > 0) ?? false);
}

function formatScoreExplanations(
  se: Partial<Record<keyof FiveDScores, string>> | null,
): string {
  if (!se) return '';
  const parts: string[] = [];
  for (const d of DIMS) {
    const x = se[d];
    if (x && x.trim()) parts.push(`${d}: ${trimToMax(x, MAX_SCORE_EXPL_PER_DIM)}`);
  }
  return parts.join(' | ');
}

function assignmentInstructionLines(
  assignRefs: Array<{
    id: string;
    title: string;
    instructions?: string | null;
    syllabusSectionId: string | null;
  }>,
  allowed: Set<string>,
  sectionLabel: (id: string | null) => string,
): string[] {
  const lines: string[] = [];
  for (const a of assignRefs) {
    if (!allowed.has(a.id)) continue;
    const ins = a.instructions?.trim() ? trimToMax(a.instructions.trim(), MAX_INSTRUCTIONS_CHARS) : '—';
    const sec = sectionLabel(a.syllabusSectionId);
    lines.push(`- ${a.title} | ${sec} | instructions: ${ins}`);
  }
  return lines;
}

export type Build5dEvidenceContext = 'class_avg' | 'student_avg' | 'module_compare';

/** Inputs for `build5dNarrativeEvidence` (5D LLM context bundle). */
export type Build5dNarrativeEvidenceInput = {
  context: Build5dEvidenceContext;
  /** Must match the chart scope (e.g. from getAllowedAssignmentIds). */
  allowedAssignmentIds: string[];
  /** For module_compare: limit rows to this syllabus section. */
  compareModuleId?: 'unplaced' | string;
  allStudents: Array<{
    id: string;
    fullName: string;
    narrativeRows: Analytics5dNarrativeRow[];
  }>;
  assignmentRefs: AnalyticsAssignmentRef[];
  singleStudentId?: string;
  /** Section id → title for unplaced / labels */
  sectionTitleResolver: (syllabusSectionId: string | null) => string;
  /** Override app default (e.g. unit tests). */
  includeTeacherNotes?: boolean;
};

/**
 * Build capped, structured evidence for explain-analytics-5d.
 * Class / compare views sample students and stratify by assignment; single-student uses all in-scope rows.
 */
function build5dNarrativeEvidenceImpl(
  input: Build5dNarrativeEvidenceInput,
): { evidenceText: string; sourceCount: number; evidenceKey: string } {
  const allow = new Set(input.allowedAssignmentIds);
  if (allow.size === 0) {
    return { evidenceText: '', sourceCount: 0, evidenceKey: hashEvidenceKey('') };
  }

  const includeTeacherNotes = input.includeTeacherNotes ?? INCLUDE_TEACHER_5D_EVIDENCE;

  const sectionLabel = (sid: string | null) => input.sectionTitleResolver(sid);

  let pool: Analytics5dNarrativeRow[] = [];
  for (const st of input.allStudents) {
    for (const r of st.narrativeRows) {
      if (!allow.has(r.assignmentId)) continue;
      if (input.context === 'module_compare' && input.compareModuleId) {
        if (input.compareModuleId === 'unplaced') {
          if (r.syllabusSectionId != null) continue;
        } else if (r.syllabusSectionId !== input.compareModuleId) {
          continue;
        }
      }
      pool.push(r);
    }
  }

  if (input.context === 'student_avg' && input.singleStudentId) {
    pool = pool.filter((r) => r.studentId === input.singleStudentId);
  } else if (input.context === 'class_avg' || input.context === 'module_compare') {
    const byStudent = new Map<string, Analytics5dNarrativeRow[]>();
    for (const r of pool) {
      if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, []);
      byStudent.get(r.studentId)!.push(r);
    }
    const ids = [...byStudent.keys()].sort();
    const picked = ids.slice(0, MAX_CLASS_STUDENT_SAMPLE);
    pool = picked.flatMap((id) => byStudent.get(id) || []);
  }

  /** Stratify: round-robin across assignment ids to avoid one task dominating. */
  const byAssign = new Map<string, Analytics5dNarrativeRow[]>();
  for (const r of pool) {
    if (!rowHasText(r, includeTeacherNotes)) continue;
    if (!byAssign.has(r.assignmentId)) byAssign.set(r.assignmentId, []);
    byAssign.get(r.assignmentId)!.push(r);
  }
  const assignKeys = [...byAssign.keys()].sort();
  const stratified: Analytics5dNarrativeRow[] = [];
  let round = 0;
  let added = 0;
  const maxRounds = 500;
  while (added < MAX_EXCERPT_BLOCKS && round < maxRounds) {
    let any = false;
    for (const aid of assignKeys) {
      const list = byAssign.get(aid)!;
      if (round < list.length) {
        stratified.push(list[round]!);
        added++;
        any = true;
        if (added >= MAX_EXCERPT_BLOCKS) break;
      }
    }
    if (!any) break;
    round++;
  }
  if (stratified.length === 0) {
    for (const r of pool) {
      if (rowHasText(r, includeTeacherNotes) && stratified.length < MAX_EXCERPT_BLOCKS) stratified.push(r);
    }
  }

  for (const r of pool) {
    if (stratified.length >= MAX_EXCERPT_BLOCKS) break;
    if (rowHasText(r, includeTeacherNotes) && !stratified.some((s) => s.submissionId === r.submissionId)) {
      stratified.push(r);
    }
  }

  const assignLines = assignmentInstructionLines(
    input.assignmentRefs.map((a) => ({
      id: a.id,
      title: a.title,
      instructions: a.instructions,
      syllabusSectionId: a.syllabusSectionId,
    })),
    allow,
    sectionLabel,
  );

  const header = [
    '## Assignment context (trimmed; numbers in the request JSON are the authority)',
    ...assignLines.slice(0, 50),
  ].join('\n');

  const excerptLines: string[] = ['## Evaluation excerpts (ground truth snippets; do not invent other quotes)'];
  for (const r of stratified) {
    const fb = r.studentFeedback?.trim()
      ? trimToMax(r.studentFeedback.trim(), MAX_STUDENT_FEEDBACK_CHARS)
      : '';
    const tn =
      includeTeacherNotes && r.teacherNote?.trim()
        ? trimToMax(r.teacherNote.trim(), MAX_TEACHER_NOTE_CHARS)
        : '';
    const ex = formatScoreExplanations(r.scoreExplanations);
    if (!fb && !ex && !tn) continue;
    excerptLines.push(
      `### ${r.studentName} | ${r.assignmentTitle} | ${r.sectionTitle}`,
      fb ? `Student-facing feedback: ${fb}` : '',
      tn ? `Teacher note: ${tn}` : '',
      ex ? `Snapshot dimension notes: ${ex}` : '',
    );
  }

  let body = [header, excerptLines.join('\n')].join('\n\n');
  if (body.length > EVIDENCE_MAX_TOTAL_CHARS) {
    body = body.slice(0, EVIDENCE_MAX_TOTAL_CHARS - 1) + '…';
  }

  const sourceCount = stratified.filter((r) => rowHasText(r, includeTeacherNotes)).length;
  return {
    evidenceText: body.trim(),
    sourceCount,
    evidenceKey: hashEvidenceKey(body),
  };
}

export function build5dNarrativeEvidence(
  input: Build5dNarrativeEvidenceInput,
): { evidenceText: string; sourceCount: number; evidenceKey: string } {
  return build5dNarrativeEvidenceImpl(input);
}

/** Exposed for unit tests. */
export const _build5dNarrativeEvidenceImpl = build5dNarrativeEvidenceImpl;
