/**
 * Client-side task parsing for assignment chat progress (mirrors perleap-chat/assignmentText.ts).
 */

const MAX_PARSED_TASKS = 10;
const MAX_TASK_TEXT_CHARS = 200;
const TASK_LIST_LINE_RE = /^\s*(?:[-*•·]\s+|\d+[.)]\s+)(.+?)\s*$/;
const TRAILING_PUNCT_RE = /[.;:,]+\s*$/;

export function resolveAssignmentTutorText(
  instructions: string,
  studentFacingTask?: string | null,
): string {
  const sft = typeof studentFacingTask === 'string' ? studentFacingTask.trim() : '';
  if (sft) return sft;
  return typeof instructions === 'string' ? instructions.trim() : '';
}

export function parseAssignmentTasks(text: string): string[] {
  if (typeof text !== 'string') return [];
  const cleaned = text
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*\[OFFICIAL_STUDENT_TASK[^\]]*\][^\n]*\n[^\n]*\n+/, '')
    .trim();
  if (!cleaned) return [];

  const collected: string[] = [];
  for (const rawLine of cleaned.split('\n')) {
    const match = rawLine.match(TASK_LIST_LINE_RE);
    if (!match) continue;
    const body = match[1].replace(TRAILING_PUNCT_RE, '').trim();
    if (body.length === 0) continue;
    collected.push(body.length > MAX_TASK_TEXT_CHARS ? body.slice(0, MAX_TASK_TEXT_CHARS).trim() : body);
  }

  if (collected.length === 0) {
    const paragraphs = cleaned.split(/\n{2,}/).map((p) => p.replace(/\s+/g, ' ').trim());
    for (const p of paragraphs) {
      if (p.length < 12) continue;
      if (/^[A-Z\s\d-]{3,40}:?$/.test(p)) continue;
      const body = p.replace(TRAILING_PUNCT_RE, '').trim();
      collected.push(body.length > MAX_TASK_TEXT_CHARS ? body.slice(0, MAX_TASK_TEXT_CHARS).trim() : body);
      if (collected.length >= MAX_PARSED_TASKS) break;
    }
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const t of collected) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(t);
    if (deduped.length >= MAX_PARSED_TASKS) break;
  }
  return deduped;
}

/** True when every parsed sub-task index is marked complete in persisted progress. */
export function areAllParsedTasksComplete(
  tutorText: string,
  completedTaskIndexes: number[] | null | undefined,
): boolean {
  const tasks = parseAssignmentTasks(tutorText);
  if (tasks.length === 0) return false;
  const set = new Set(
    (completedTaskIndexes ?? []).filter((n) => Number.isFinite(n) && n >= 1 && n <= tasks.length),
  );
  if (set.size !== tasks.length) return false;
  for (let i = 1; i <= tasks.length; i++) {
    if (!set.has(i)) return false;
  }
  return true;
}
