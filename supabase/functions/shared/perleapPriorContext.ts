/** Shared helpers for prior-unit snippets injected into tutor prompts */

export function stripPerleapGreetingPrefixesFromExcerpt(raw: string): string {
  let s = raw.replace(/\r\n/g, '\n');
  const patterns = [
    /^Hello! I am Perleap,[^\n]+\n*/i,
    /^שלום! אני Perleap[^\n]*\n*/i,
  ];
  let prev = '';
  while (prev !== s) {
    prev = s;
    for (const r of patterns) {
      s = s.replace(r, '');
    }
    s = s.trimStart();
  }
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

export const PRIOR_MERGE_TOTAL_MAX = 10_000;
export const PRIOR_MERGE_SEP = '\n\n=== Earlier in this course ===\n\n';

/** Max prior submission IDs merged (DB syllabus chain + client). Keep in sync with getPriorSubmissionIdsInSameSection cap. */
export const MAX_UNIT_PRIOR_SUBMISSION_IDS = 8;

/**
 * Tighter cap for perleap-chat (the live tutor turn). Feedback generation can still
 * use the wider cap above; chat needs the assignment to be dominant in attention.
 */
export const MAX_UNIT_PRIOR_SUBMISSION_IDS_CHAT = 3;

/** How many priors (post-gate) get rendered verbatim. Anything older is summary-compressed. */
export const PRIOR_VERBATIM_COUNT_CHAT = 2;

/** Minimum visible-content length for a prior chunk to be kept in the chat prompt. */
export const PRIOR_MIN_CHUNK_BODY_CHARS = 80;

export { isCourseRecallRequest } from './courseRecall.ts';

/** @deprecated Use isCourseRecallRequest */
export { isCourseRecallRequest as isExplicitPastWorkRecallRequest } from './courseRecall.ts';

/** Max chars per prior excerpt slice when merging multiple priors into one system prompt */
export const PRIOR_MERGE_PER_SUBMISSION_CEILING_CHARS = 1_000;

/** Larger per-submission cap on course-recall turns (verbatim prior work). */
export const PRIOR_EXPLICIT_RECALL_PER_SUBMISSION_CEILING_CHARS = 8_000;

/** Full merged prior budget when the student asks to recall work from anywhere in the course. */
export const PRIOR_COURSE_RECALL_MERGE_MAX_CHARS = 10_000;

/** On initial tutor turn, multiply merged prior budget by this factor (fraction in (0,1]). */
export const PRIOR_MERGE_GREETING_BUDGET_FRACTION = 0.5;

/** Max chars for combined course resources, outline, assignment materials list, and linked module text in tutor system prompt */
export const MAX_CHAT_MATERIALS_MODULE_CONTEXT_CHARS = 12_000;

/**
 * Normalize an assistant/student line for fingerprint matching during dedupe.
 * Lowercases, collapses whitespace, drops trailing punctuation.
 */
function fingerprintLine(line: string): string {
  return line
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?,;:]+\s*$/g, '')
    .trim();
}

/**
 * Dedupe identical `Assistant: ...` / `Student: ...` lines that appear across multiple
 * prior-submission chunks. Keeps the first occurrence; drops subsequent exact duplicates
 * (after normalization). Preserves the chunk separator structure - each input string is
 * a full chunk that may have multiple lines.
 */
export function dedupeAssistantLinesAcrossPriors(chunks: string[]): string[] {
  const seen = new Set<string>();
  return chunks.map((chunk) => {
    const lines = chunk.split('\n');
    const kept: string[] = [];
    for (const line of lines) {
      const m = line.match(/^\s*(Assistant|Student|Perleap):\s*(.*)$/i);
      if (!m) {
        kept.push(line);
        continue;
      }
      const body = m[2];
      if (body.trim().length < 12) {
        kept.push(line);
        continue;
      }
      const fp = `${m[1].toLowerCase()}::${fingerprintLine(body)}`;
      if (seen.has(fp)) continue;
      seen.add(fp);
      kept.push(line);
    }
    return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }).filter((c) => c.length > 0);
}
