/**
 * Supabase Client Helpers
 * Shared utilities for Supabase operations in edge functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import type { SupabaseConfig, Message } from './types.ts';
import { buildModuleActivityContextBundle } from '../_shared/assignmentContext.ts';
import {
  stripPerleapGreetingPrefixesFromExcerpt,
  MAX_UNIT_PRIOR_SUBMISSION_IDS,
  MAX_UNIT_PRIOR_SUBMISSION_IDS_CHAT,
} from './perleapPriorContext.ts';
import {
  COURSE_RECALL_MAX_PRIOR_SUBMISSIONS,
  rankPriorSubmissionCandidates,
  type PriorSubmissionCandidate,
} from './courseRecall.ts';
import { optionLabelsForIds, parseOptionIds } from './testMcq.ts';

/**
 * Resolve elevated API key: prefer hosted `SUPABASE_SECRET_KEYS` (sb_secret_...)
 * over legacy JWT `SUPABASE_SERVICE_ROLE_KEY`.
 */
export const getServiceRoleKey = (): string => {
  const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeysRaw) {
    try {
      const parsed = JSON.parse(secretKeysRaw) as Record<string, string>;
      for (const name of ['new_secret_key', 'default']) {
        const value = parsed[name];
        if (typeof value === 'string' && value.length > 0) return value;
      }
      const first = Object.values(parsed).find(
        (value) => typeof value === 'string' && value.length > 0,
      );
      if (first) return first;
    } catch {
      // fall through to legacy key
    }
  }

  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;

  throw new Error('Supabase configuration missing');
};

/**
 * Get Supabase configuration from environment
 */
export const getSupabaseConfig = (): SupabaseConfig => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = getServiceRoleKey();

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase configuration missing');
  }

  return { url, serviceRoleKey };
};

/**
 * Create Supabase client with service role
 */
export const createSupabaseClient = () => {
  const config = getSupabaseConfig();
  return createClient(config.url, config.serviceRoleKey);
};

/**
 * Fetch teacher name by assignment ID
 */
export const getTeacherNameByAssignment = async (
  assignmentId: string,
): Promise<string> => {
  const supabase = createSupabaseClient();

  const { data: assignmentData, error: assignmentError } = await supabase
    .from('assignments')
    .select('classroom_id, classrooms(teacher_id)')
    .eq('id', assignmentId)
    .single();

  if (assignmentError || !assignmentData) {
    return 'your teacher';
  }

  if (assignmentData?.classrooms?.teacher_id) {
    const { data: teacherProfile } = await supabase
      .from('teacher_profiles')
      .select('full_name')
      .eq('user_id', assignmentData.classrooms.teacher_id)
      .maybeSingle();

    if (teacherProfile?.full_name) {
      return teacherProfile.full_name;
    }
  }

  return 'your teacher';
};

/**
 * Fetch student name by user ID
 */
export const getStudentName = async (studentId: string): Promise<string> => {
  const supabase = createSupabaseClient();

  const { data: studentProfile } = await supabase
    .from('student_profiles')
    .select('full_name')
    .eq('user_id', studentId)
    .maybeSingle();

  return studentProfile?.full_name || 'the student';
};

/**
 * Get or create conversation
 */
export const getOrCreateConversation = async (
  submissionId: string,
): Promise<{
  id: string;
  messages: Message[];
  lastResponseId: string | null;
  completedTaskIndexes: number[];
}> => {
  const supabase = createSupabaseClient();

  const { data: conversations, error: convError } = await supabase
    .from('assignment_conversations')
    .select('*')
    .eq('submission_id', submissionId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (convError) {
    throw new Error(`Error fetching conversation: ${convError.message}`);
  }

  if (conversations && conversations.length > 0) {
    const row = conversations[0];
    const rawIdx = row.completed_task_indexes;
    const completedTaskIndexes = Array.isArray(rawIdx)
      ? rawIdx
          .map((v: unknown) => (typeof v === 'number' ? v : parseInt(String(v), 10)))
          .filter((n: number) => Number.isFinite(n) && n > 0)
      : [];
    return {
      id: row.id,
      messages: row.messages || [],
      lastResponseId:
        typeof row.last_openai_response_id === 'string'
          ? row.last_openai_response_id
          : null,
      completedTaskIndexes,
    };
  }

  return {
    id: '',
    messages: [],
    lastResponseId: null,
    completedTaskIndexes: [],
  };
};

/** Max persisted messages per assignment_conversations row (keeps rows from ballooning). */
const SAVE_CONVERSATION_MAX_MESSAGES = 50;
/** Snapshots (raw_model_text + openai_chat_request_snapshot + polish snapshot) are heavy; keep them only on the most recent N messages. */
const SAVE_CONVERSATION_KEEP_SNAPSHOTS_LAST_N = 10;

/**
 * Trim a messages array for persistence: keep at most `SAVE_CONVERSATION_MAX_MESSAGES` entries
 * (most recent), and strip per-turn debug snapshots (`raw_model_text`,
 * `openai_chat_request_snapshot`, `openai_polish_chat_request_snapshot`) from all but the most
 * recent `SAVE_CONVERSATION_KEEP_SNAPSHOTS_LAST_N` messages. Returns a new array; never mutates
 * the input.
 */
export function trimMessagesForPersistence(messages: Message[]): Message[] {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const start = Math.max(0, messages.length - SAVE_CONVERSATION_MAX_MESSAGES);
  const window = messages.slice(start);
  const stripFromIdx = Math.max(0, window.length - SAVE_CONVERSATION_KEEP_SNAPSHOTS_LAST_N);
  return window.map((m, idx) => {
    if (idx >= stripFromIdx) return m;
    if (m && typeof m === 'object') {
      const { raw_model_text: _r, openai_chat_request_snapshot: _s, openai_polish_chat_request_snapshot: _p, ...rest } = m as Record<string, unknown>;
      return rest as Message;
    }
    return m;
  });
}

/**
 * Save conversation messages. Optionally store the OpenAI Responses-API response id for
 * previous_response_id chaining on the next turn.
 */
export const saveConversation = async (
  conversationId: string,
  submissionId: string,
  studentId: string,
  assignmentId: string,
  messages: Message[],
  responseId?: string | null,
  completedTaskIndexes?: number[],
): Promise<void> => {
  const supabase = createSupabaseClient();

  const trimmed = trimMessagesForPersistence(messages);

  const update: Record<string, unknown> = {
    messages: trimmed,
    updated_at: new Date().toISOString(),
  };
  if (typeof responseId === 'string' && responseId.length > 0) {
    update.last_openai_response_id = responseId;
  }
  if (Array.isArray(completedTaskIndexes)) {
    const sanitized = [
      ...new Set(
        completedTaskIndexes.filter((n) => Number.isFinite(n) && n > 0),
      ),
    ].sort((a, b) => a - b);
    update.completed_task_indexes = sanitized;
  }

  if (conversationId) {
    await supabase
      .from('assignment_conversations')
      .update(update)
      .eq('id', conversationId);
  } else {
    const insertRow: Record<string, unknown> = {
      submission_id: submissionId,
      student_id: studentId,
      assignment_id: assignmentId,
      messages: trimmed,
    };
    if (typeof responseId === 'string' && responseId.length > 0) {
      insertRow.last_openai_response_id = responseId;
    }
    if (update.completed_task_indexes) {
      insertRow.completed_task_indexes = update.completed_task_indexes;
    }
    await supabase.from('assignment_conversations').insert(insertRow);
  }
};

/**
 * Fetch full teacher profile with teaching style data
 */
export const getTeacherProfile = async (teacherId: string) => {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('teacher_profiles')
    .select('*')
    .eq('user_id', teacherId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
};

/**
 * Fetch full student profile with learning preferences
 */
export const getStudentProfile = async (studentId: string) => {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('student_profiles')
    .select('*')
    .eq('user_id', studentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
};

/**
 * Fetch assignment details including hard_skills, domain, and materials
 */
export const getAssignmentDetails = async (assignmentId: string) => {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('assignments')
    .select('hard_skills, hard_skill_domain, materials, instructions, student_facing_task, classroom_id, type')
    .eq('id', assignmentId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
};

/**
 * Plain-text bundle of linked module activities for AI prompts (chat, feedback).
 */
export const getAssignmentModuleActivityContextText = async (
  assignmentId: string,
): Promise<string> => {
  const supabase = createSupabaseClient();

  const { data: links, error } = await supabase
    .from('assignment_module_activities')
    .select('activity_list_id, order_index, include_in_ai_context')
    .eq('assignment_id', assignmentId)
    .order('order_index', { ascending: true });

  if (error || !links?.length) {
    return '';
  }

  const ids = [...new Set((links as { activity_list_id: string }[]).map((l) => l.activity_list_id))];
  const { data: resources, error: resErr } = await supabase
    .from('activity_list')
    .select('id, title, resource_type, url, body_text, summary, status, lesson_content')
    .in('id', ids)
    .eq('active', true);

  if (resErr || !resources?.length) {
    return '';
  }

  const map = new Map(
    (resources as Record<string, unknown>[]).map((r) => [r.id as string, r as any]),
  );
  const { text } = buildModuleActivityContextBundle(links as any, map);
  return text;
};

/**
 * Fetch classroom resources (course-level materials)
 */
export const getClassroomResources = async (classroomId: string) => {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('classrooms')
    .select('resources, course_outline')
    .eq('id', classroomId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
};

/**
 * Get teacher ID from assignment ID
 */
export const getTeacherIdFromAssignment = async (
  assignmentId: string,
): Promise<string | null> => {
  const supabase = createSupabaseClient();

  const { data: assignmentData, error: assignmentError } = await supabase
    .from('assignments')
    .select('classroom_id, classrooms(teacher_id)')
    .eq('id', assignmentId)
    .single();

  if (assignmentError || !assignmentData) {
    return null;
  }

  return (assignmentData?.classrooms as any)?.teacher_id || null;
};

/** True if user is in public.app_admins (service-role client; used from Edge Functions). */
export const isAppAdmin = async (userId: string): Promise<boolean> => {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc('is_app_admin', { _user_id: userId });
  if (error) {
    console.error('is_app_admin rpc', error);
    return false;
  }
  return data === true;
};

/**
 * Completed learner submissions in the same syllabus section + classroom (excluding current assignment),
 * one row per assignment (latest completion), ordered oldest → newest by submitted_at.
 */
export async function getPriorSubmissionIdsInSameSection(
  studentId: string,
  currentAssignmentId: string,
): Promise<string[]> {
  const supabase = createSupabaseClient();

  const { data: curr, error: e0 } = await supabase
    .from('assignments')
    .select('classroom_id, syllabus_section_id')
    .eq('id', currentAssignmentId)
    .maybeSingle();
  if (e0 || !curr?.classroom_id || !curr.syllabus_section_id) {
    return [];
  }

  const { data: sectionAssignments, error: e1 } = await supabase
    .from('assignments')
    .select('id')
    .eq('classroom_id', curr.classroom_id)
    .eq('syllabus_section_id', curr.syllabus_section_id)
    .neq('id', currentAssignmentId);
  if (e1 || !sectionAssignments?.length) return [];

  const assignmentIds = sectionAssignments.map((a) => a.id);
  const { data: subs, error: e2 } = await supabase
    .from('submissions')
    .select('id, assignment_id, submitted_at')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .eq('is_teacher_attempt', false)
    .in('assignment_id', assignmentIds)
    .order('submitted_at', { ascending: false });

  if (e2 || !subs?.length) return [];

  const latestByAssignment = new Map<string, { id: string; submitted_at: string }>();
  for (const s of subs) {
    const prev = latestByAssignment.get(s.assignment_id);
    if (!prev || String(s.submitted_at) > String(prev.submitted_at)) {
      latestByAssignment.set(s.assignment_id, { id: s.id, submitted_at: String(s.submitted_at) });
    }
  }
  const ordered = [...latestByAssignment.values()].sort((a, b) =>
    a.submitted_at.localeCompare(b.submitted_at),
  );
  let ids = ordered.map((x) => x.id);
  if (ids.length > MAX_UNIT_PRIOR_SUBMISSION_IDS) {
    ids = ids.slice(-MAX_UNIT_PRIOR_SUBMISSION_IDS);
  }
  return ids;
}

function sectionTitleFromJoin(
  joined: unknown,
): string {
  if (joined && typeof joined === 'object' && !Array.isArray(joined) &&
    'title' in joined && typeof (joined as { title?: string }).title === 'string') {
    return (joined as { title: string }).title;
  }
  return '';
}

async function listClassroomPriorCandidates(
  studentId: string,
  currentAssignmentId: string,
  opts?: { otherSectionsOnly?: boolean },
): Promise<{ candidates: PriorSubmissionCandidate[]; classroomId: string | null }> {
  const supabase = createSupabaseClient();
  const { data: curr, error: e0 } = await supabase
    .from('assignments')
    .select('classroom_id, syllabus_section_id')
    .eq('id', currentAssignmentId)
    .maybeSingle();
  if (e0 || !curr?.classroom_id) {
    return { candidates: [], classroomId: null };
  }

  let query = supabase
    .from('assignments')
    .select('id, title, syllabus_sections(title)')
    .eq('classroom_id', curr.classroom_id)
    .neq('id', currentAssignmentId);

  if (opts?.otherSectionsOnly && curr.syllabus_section_id) {
    query = query.neq('syllabus_section_id', curr.syllabus_section_id);
  }

  const { data: assignments, error: e1 } = await query;
  if (e1 || !assignments?.length) {
    return { candidates: [], classroomId: curr.classroom_id };
  }

  const assignmentMeta = new Map<string, string>();
  for (const a of assignments) {
    const sectionTitle = sectionTitleFromJoin(a.syllabus_sections);
    assignmentMeta.set(a.id, `${a.title ?? ''} ${sectionTitle}`.trim());
  }

  const assignmentIds = assignments.map((a) => a.id);
  const { data: subs, error: e2 } = await supabase
    .from('submissions')
    .select('id, assignment_id, submitted_at')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .eq('is_teacher_attempt', false)
    .in('assignment_id', assignmentIds)
    .order('submitted_at', { ascending: false });

  if (e2 || !subs?.length) {
    return { candidates: [], classroomId: curr.classroom_id };
  }

  const latestByAssignment = new Map<string, { id: string; submitted_at: string }>();
  for (const s of subs) {
    const prev = latestByAssignment.get(s.assignment_id);
    if (!prev || String(s.submitted_at) > String(prev.submitted_at)) {
      latestByAssignment.set(s.assignment_id, {
        id: s.id,
        submitted_at: String(s.submitted_at),
      });
    }
  }

  const candidates: PriorSubmissionCandidate[] = [];
  for (const [assignmentId, sub] of latestByAssignment) {
    candidates.push({
      id: sub.id,
      submitted_at: sub.submitted_at,
      label: assignmentMeta.get(assignmentId) ?? '',
    });
  }
  return { candidates, classroomId: curr.classroom_id };
}

/**
 * Course-wide recall: rank all completed submissions in the classroom (any unit)
 * by relevance to the student's message; return the best match(es).
 */
export async function getPriorSubmissionIdsForCourseRecall(
  studentId: string,
  currentAssignmentId: string,
  relevanceText: string,
  maxIds: number = COURSE_RECALL_MAX_PRIOR_SUBMISSIONS,
): Promise<string[]> {
  const { candidates } = await listClassroomPriorCandidates(studentId, currentAssignmentId);
  return rankPriorSubmissionCandidates(candidates, relevanceText, maxIds);
}

/**
 * Completed learner submissions in other syllabus sections of the same classroom
 * (excluding current assignment), one row per assignment (latest completion),
 * ordered oldest → newest by submitted_at.
 */
export async function getPriorSubmissionIdsInOtherSections(
  studentId: string,
  currentAssignmentId: string,
  relevanceText?: string,
): Promise<string[]> {
  const { candidates } = await listClassroomPriorCandidates(
    studentId,
    currentAssignmentId,
    { otherSectionsOnly: true },
  );
  const ref = relevanceText?.trim() ?? '';
  if (ref) {
    return rankPriorSubmissionCandidates(
      candidates,
      ref,
      MAX_UNIT_PRIOR_SUBMISSION_IDS_CHAT,
    );
  }
  candidates.sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  let ids = candidates.map((x) => x.id);
  if (ids.length > MAX_UNIT_PRIOR_SUBMISSION_IDS) {
    ids = ids.slice(-MAX_UNIT_PRIOR_SUBMISSION_IDS);
  }
  return ids;
}

const PRIOR_CONTEXT_MAX_CHARS = 5000;
const PRIOR_CONTEXT_RECALL_MAX_CHARS = 8_000;

function stripChatContentForPriorContext(raw: string): string {
  let s = String(raw ?? '').replace(/\r\n/g, '\n');
  s = s.replace(/\[File:\s*[^\]]+\]\s*URL:\s*https?:\/\/\S+/gi, '[attachment]');
  return s.trim();
}

const PRIOR_JSON_ARTIFACT_PLACEHOLDER =
  '[Prior written work: large structured / JSON artifact omitted from tutor context.]';

/** Skip `text_body` submissions shorter than this - one-word answers like "test" add noise without signal. */
const MIN_PRIOR_TEXT_BODY_CHARS = 40;

/** Avoid dumping langchain-sized JSON graphs into merged prior-unit context */
function looksLikeJsonHeavySubmissionBody(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/["']schemaVersion["']\s*:/i.test(t)) return true;

  const head = t.slice(0, Math.min(t.length, 24_000));
  const structureChars = (head.match(/[{}[\]",':]/g) ?? []).length;
  const brackets = (head.match(/[{[]/g) ?? []).length;

  if (/^\s*[{[]/.test(t)) {
    if (head.length >= 400 && structureChars / head.length >= 0.09) return true;
    if (head.length >= 1200 && brackets >= 40) return true;
  }
  if (t.length > 4000 && brackets >= 50) return true;
  return false;
}

const COMPLETION_MARKER_CORRUPT_SENTINEL = '[completion marker corrupted; omitted]';

/** Normalize obvious completion-marker typos / truncated tails so prior context does not teach bad markers. */
function scrubCompletionMarkerTypos(raw: string): string {
  let t = raw.trim();
  if (!t) return '';
  t = t.replace(/\bCONATION_COMPLETE\b|\[CONATION_COMPLETE\]/gi, COMPLETION_MARKER_CORRUPT_SENTINEL);
  const lastOpen = t.lastIndexOf('[');
  const lastClose = t.lastIndexOf(']');
  if (lastOpen > lastClose && lastOpen !== -1) {
    const frag = t.slice(lastOpen);
    if (/^\[(?:CON|CONVERSATION)?/i.test(frag)) {
      t = t.slice(0, lastOpen).trimEnd() + ` ${COMPLETION_MARKER_CORRUPT_SENTINEL}`;
    }
  }
  return t;
}

/**
 * Detect prior-assistant disclaimer lines that contradict the new "use prior context for
 * factual recall" rule. Examples: "I do not have access to past lessons", "I cannot recall",
 * "I do not remember", "אין לי גישה". Drop those lines so the model does not imitate them.
 */
function isPriorAssistantDisclaimer(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const patterns: RegExp[] = [
    /\bi\s+(do\s+not|don't|do\s*not)\s+have\s+access\b/i,
    /\bi\s+(do\s+not|don't)\s+remember\b/i,
    /\bi\s+(cannot|can't|can\s+not)\s+recall\b/i,
    /\bi\s+(do\s+not|don't)\s+have\s+(?:any\s+)?(?:memory|access|recollection)\b/i,
    /\bunless\s+you\s+share\s+them\s+here\b/i,
    /\bunless\s+you\s+share\s+it\s+with\s+me\b/i,
    /אין\s+לי\s+גישה/,
    /אני\s+לא\s+זוכר/,
    /אני\s+אינני\s+זוכר/,
  ];
  return patterns.some((p) => p.test(t));
}

/**
 * Normalize a line for near-duplicate fingerprinting (lower, collapsed whitespace, no trailing punct).
 * 48-char window collapses near-paraphrases (e.g. "hi, what does \"fdsfds\" refer to in your assignment"
 * vs "what does \"fdsfds\" in the assignment instructions refer to" become very similar prefixes).
 */
function fingerprintAssistantLine(text: string): string {
  return text
    .toLowerCase()
    .replace(/^\s*(hi|hello|hey|שלום)[,.\s]+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?,;:]+\s*$/g, '')
    .trim()
    .slice(0, 48);
}

/**
 * Assistant "clarify a garbage student token" lines: noise, no signal.
 * Matches: "Hi, what does 'fds' refer to ...", "What is \"x\" mean ...",
 * and forms with up to ~6 words of slack between the quote and the verb,
 * e.g. "What does 'fdsfds' in the assignment instructions refer to?".
 */
const CLARIFICATION_QUESTION_RE =
  /^(hi[,.]?\s+)?what\s+(does|is)\s+["'][^"']{1,12}["']\s+(?:\S+\s+){0,6}(refer\s+to|mean)/i;

/** Substantive student reply test: at least 12 chars and not a one-word filler. */
function isSubstantiveStudentReply(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return false;
  if (/^(ok(ay)?|yes|no|sure|nope|yep|yeah|thanks?)[.!?\s]*$/i.test(t)) return false;
  return true;
}

/** All student turns (newest included), minimal filtering — for course-recall. */
function formatStudentMessagesForCourseRecall(
  messages: Message[],
  maxChars: number,
): string {
  const parts: string[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.role !== 'user' || typeof m.content !== 'string') continue;
    const text = stripChatContentForPriorContext(m.content).trim();
    if (text.length < 4) continue;
    const piece = `Student: ${text}\n\n`;
    if (total + piece.length > maxChars) break;
    parts.push(piece);
    total += piece.length;
  }
  return parts.reverse().join('').trim();
}

function collectStringsFromJson(value: unknown, out: string[], depth = 0): void {
  if (depth > 12) return;
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.length >= 20) out.push(t);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringsFromJson(item, out, depth + 1);
    return;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectStringsFromJson(v, out, depth + 1);
    }
  }
}

/** Pull human-readable prompt text from langchain / JSON submission bodies. */
function extractRecallableTextFromSubmissionBody(text: string): string | null {
  if (!looksLikeJsonHeavySubmissionBody(text)) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    const strings: string[] = [];
    collectStringsFromJson(parsed, strings);
    strings.sort((a, b) => b.length - a.length);
    const best = strings.find((s) => s.length >= 40);
    if (best) return best.slice(0, 6_000);
  } catch {
    // fall through
  }
  const promptField = text.match(
    /"(?:system_?prompt|final_?prompt|user_?prompt|prompt)"\s*:\s*"((?:\\.|[^"\\]){20,})"/i,
  );
  if (promptField?.[1]) {
    return promptField[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').slice(0, 6_000);
  }
  return text.slice(0, 4_000);
}

function formatMessagesForPriorContext(
  messages: Message[],
  opts?: { minUserLineChars?: number; maxTotalChars?: number },
): string {
  const minUser = opts?.minUserLineChars ?? 12;
  const maxTotal = opts?.maxTotalChars ?? PRIOR_CONTEXT_MAX_CHARS;
  const parts: string[] = [];
  let total = 0;
  const seenAssistantFingerprints = new Set<string>();
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    if (typeof m.content !== 'string') continue;

    let text = stripPerleapGreetingPrefixesFromExcerpt(
      stripChatContentForPriorContext(m.content),
    );
    text = scrubCompletionMarkerTypos(text);
    const trimmed = text.trim();
    if (!trimmed) continue;

    const role = m.role;
    const minLen = role === 'user' ? minUser : 12;
    if (trimmed.length < minLen) continue;

    if (role === 'assistant' && isPriorAssistantDisclaimer(trimmed)) continue;

    if (role === 'assistant') {
      const fp = fingerprintAssistantLine(trimmed);
      if (fp && seenAssistantFingerprints.has(fp)) continue;
      if (fp) seenAssistantFingerprints.add(fp);

      if (CLARIFICATION_QUESTION_RE.test(trimmed)) {
        const newer = i + 1 < messages.length ? messages[i + 1] : null;
        const newerIsSubstantiveStudent =
          newer?.role === 'user' &&
          typeof newer.content === 'string' &&
          isSubstantiveStudentReply(newer.content);
        if (!newerIsSubstantiveStudent) continue;
      }
    }

    const newer = i + 1 < messages.length ? messages[i + 1] : null;
    const newerRole = newer?.role === 'user' || newer?.role === 'assistant' ? newer.role : null;
    // Drop tiny assistant stubs when wedged between other assistant retries (often noise)
    if (role === 'assistant' && newerRole === 'assistant') {
      const words = trimmed.split(/\s+/).filter(Boolean).length;
      const hasQuestion = /\?\s*$/.test(trimmed);
      if (words <= 14 && text.length < 80 && !hasQuestion && !/\[attachment\]|\[CONVERSATION_COMPLETE\]/.test(text)) {
        continue;
      }
    }

    const label = role === 'user' ? 'Student' : 'Assistant';
    const piece = `${label}: ${text}\n\n`;
    if (total + piece.length > maxTotal) break;
    parts.push(piece);
    total += piece.length;
  }
  return parts.reverse().join('').trim();
}

export type PriorExcerptOptions = {
  /** Include essay / short text_body (below the usual noise floor). */
  includeShortWrittenWork?: boolean;
  /** Put submitted written work and test answers before chat transcript. */
  preferWrittenWorkFirst?: boolean;
  /** Keep shorter student chat lines (course-recall turns). */
  relaxedChat?: boolean;
  /** Allow a larger excerpt per prior submission. */
  expandedBudget?: boolean;
};

/**
 * Returns bounded plain-text context from a prior submission: Perleap chat transcript,
 * submission text_body, and/or free-text test answers — after validating same student + classroom.
 */
export const getValidatedPriorAssignmentChatExcerpt = async (
  priorSubmissionId: string,
  studentId: string,
  currentAssignmentId: string,
  opts?: PriorExcerptOptions,
): Promise<string | null> => {
  const supabase = createSupabaseClient();

  const { data: priorSub, error: e1 } = await supabase
    .from('submissions')
    .select('student_id, assignment_id, text_body')
    .eq('id', priorSubmissionId)
    .maybeSingle();
  if (e1 || !priorSub) return null;
  if (priorSub.student_id !== studentId) return null;
  if (priorSub.assignment_id === currentAssignmentId) return null;

  const { data: priorClassRow, error: e2 } = await supabase
    .from('assignments')
    .select('classroom_id, type, title')
    .eq('id', priorSub.assignment_id)
    .maybeSingle();
  const { data: currClassRow, error: e3 } = await supabase
    .from('assignments')
    .select('classroom_id')
    .eq('id', currentAssignmentId)
    .maybeSingle();
  if (e2 || e3 || !priorClassRow || !currClassRow) return null;
  if (priorClassRow.classroom_id !== currClassRow.classroom_id) return null;

  const isEssayAssignment = priorClassRow.type === 'text_essay';
  const courseRecallMode = opts?.expandedBudget === true;
  const includeShortWritten =
    opts?.includeShortWrittenWork === true || isEssayAssignment || courseRecallMode;
  const preferWrittenFirst =
    opts?.preferWrittenWorkFirst === true || isEssayAssignment || courseRecallMode;
  const maxContextChars = courseRecallMode
    ? PRIOR_CONTEXT_RECALL_MAX_CHARS
    : PRIOR_CONTEXT_MAX_CHARS;

  let chatExcerpt = '';
  const { data: convRows, error: e4 } = await supabase
    .from('assignment_conversations')
    .select('messages')
    .eq('submission_id', priorSubmissionId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (!e4 && convRows?.length) {
    const raw = convRows[0].messages;
    if (Array.isArray(raw) && raw.length > 0) {
      const msgs = raw as Message[];
      if (courseRecallMode) {
        const studentRecall = formatStudentMessagesForCourseRecall(msgs, maxContextChars);
        const standard = formatMessagesForPriorContext(msgs, {
          minUserLineChars: 4,
          maxTotalChars: maxContextChars,
        });
        chatExcerpt = studentRecall.length >= standard.length ? studentRecall : standard;
      } else {
        chatExcerpt = formatMessagesForPriorContext(msgs, {
          minUserLineChars: opts?.relaxedChat ? 4 : 12,
          maxTotalChars: maxContextChars,
        }) || '';
      }
    }
  }

  const writtenSections: string[] = [];
  const chatSections: string[] = [];
  const assignmentTitle =
    typeof priorClassRow.title === 'string' ? priorClassRow.title.trim() : '';
  if (assignmentTitle) {
    writtenSections.push(`Prior assignment: ${assignmentTitle}`);
  }

  const tb = typeof priorSub.text_body === 'string' ? priorSub.text_body.trim() : '';
  const tbLongEnough = tb.length >= MIN_PRIOR_TEXT_BODY_CHARS;
  if (tb && (tbLongEnough || includeShortWritten)) {
    if (looksLikeJsonHeavySubmissionBody(tb)) {
      const extracted = courseRecallMode ? extractRecallableTextFromSubmissionBody(tb) : null;
      if (extracted) {
        writtenSections.push(`Submitted written work (prior assignment):\n${extracted}`);
      } else if (!courseRecallMode) {
        writtenSections.push(
          `Submitted written work (prior assignment):\n${PRIOR_JSON_ARTIFACT_PLACEHOLDER}`,
        );
      }
    } else {
      const cleaned = stripChatContentForPriorContext(tb).slice(0, courseRecallMode ? 6_000 : 4_000);
      if (cleaned) {
        writtenSections.push(`Submitted written work (prior assignment):\n${cleaned}`);
      }
    }
  }

  if (chatExcerpt.trim()) chatSections.push(chatExcerpt.trim());

  const { data: testRows, error: eTr } = await supabase
    .from('test_responses')
    .select('question_id, selected_option_id, selected_option_ids, text_answer')
    .eq('submission_id', priorSubmissionId);

  if (!eTr && testRows?.length) {
    const qids = [...new Set(testRows.map((r) => r.question_id))];
    const { data: questions, error: eQ } =
      qids.length > 0
        ? await supabase
            .from('test_questions')
            .select('id, question_text, options')
            .in('id', qids)
        : { data: [] as { id: string; question_text: string; options: unknown }[], error: null };

    const qmap = new Map((questions ?? []).map((q) => [q.id, q]));

    const testLines: string[] = [];
    for (const tr of testRows) {
      const q = qmap.get(tr.question_id);
      const qtext = (q?.question_text ?? 'Question').trim();
      const ta = typeof tr.text_answer === 'string' ? tr.text_answer.trim() : '';
      if (ta) {
        testLines.push(`${qtext}\nAnswer: ${stripChatContentForPriorContext(ta)}`);
        continue;
      }
      const selectedIds = parseOptionIds(tr.selected_option_ids, tr.selected_option_id);
      if (selectedIds.length === 0) continue;

      let labels: string[] = [];
      if (q?.options && Array.isArray(q.options)) {
        const opts = q.options as { id?: unknown; text?: unknown }[];
        const normalizedOptions = opts.map((o) => ({
          id: String(o?.id ?? ''),
          text: typeof o?.text === 'string' ? o.text : String(o?.id ?? ''),
        }));
        labels = optionLabelsForIds(normalizedOptions, selectedIds).map((label) =>
          stripChatContentForPriorContext(label),
        );
      }

      if (labels.length > 0) {
        testLines.push(
          `${qtext}\nSelected: ${labels.length > 1 ? labels.join('; ') : labels[0]}`,
        );
      } else {
        testLines.push(
          `${qtext}\nSelected: (multiple-choice; stored option ids: ${selectedIds.join(', ')})`,
        );
      }
    }

    if (testLines.length > 0) {
      writtenSections.push(
        `Prior assignment test responses:\n${testLines.join('\n\n')}`.slice(0, 4000),
      );
    }
  }

  const sections = preferWrittenFirst
    ? [...writtenSections, ...chatSections]
    : [...chatSections, ...writtenSections];

  if (sections.length === 0) return null;

  let out = stripPerleapGreetingPrefixesFromExcerpt(sections.join('\n\n---\n\n'));
  if (out.length > maxContextChars) {
    out = preferWrittenFirst
      ? out.slice(0, maxContextChars)
      : out.slice(out.length - maxContextChars);
  }
  return stripPerleapGreetingPrefixesFromExcerpt(out.trim()) || null;
};

