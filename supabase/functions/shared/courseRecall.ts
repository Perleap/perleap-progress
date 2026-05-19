/**
 * Course-wide recall: when a student asks about work from any prior unit/assignment,
 * retrieve and surface the right completed submission(s) across the whole classroom.
 */

import { countKeywordOverlap, hasKeywordOverlap } from '../_shared/topicOverlap.ts';

/** Max prior submissions loaded on an explicit course-recall turn (keep focused). */
export const COURSE_RECALL_MAX_PRIOR_SUBMISSIONS = 2;

export function isCourseRecallRequest(message: string): boolean {
  const m = message.trim();
  if (m.length < 8) return false;
  const signals: RegExp[] = [
    /\b(do you |did you )?remember\b/i,
    /\b(recall|remind|recollect)\b/i,
    /\bmy (final |end )?(prompt|answer|submission|response|work)\b/i,
    /\bwhat (was |did )?my\b/i,
    /\bwhat did i (write|say|submit)\b/i,
    /\b(in |from )?unit\s+\d+/i,
    /\bunit\s+\d+\s*:/i,
    /\bearlier\b/i,
    /\bprevious\b/i,
    /\bpast (work|assignment|unit)\b/i,
    /\bmy answer to\b/i,
    /\bprompt i wrote\b/i,
    /\b(can you )?(show|repeat|tell)\b/i,
  ];
  return signals.some((re) => re.test(m));
}

function unitHintScore(label: string, relevanceText: string): number {
  const m = relevanceText.match(/\bunit\s+(\d+)\b/i);
  if (!m) return 0;
  const n = m[1];
  if (new RegExp(`\\bunit\\s*${n}\\b`, 'i').test(label)) return 12;
  if (new RegExp(`\\b${n}\\b`).test(label)) return 4;
  return 0;
}

/** "unit 3: design the email organizer" → match assignment/section titles. */
export function unitColonHintScore(label: string, relevanceText: string): number {
  const m = relevanceText.match(/\bunit\s+\d+\s*:\s*([^?.!\n]+)/i);
  if (!m) return 0;
  const hint = m[1].trim().toLowerCase();
  if (hint.length < 4) return 0;
  const labelLower = label.toLowerCase();
  if (labelLower.includes(hint)) return 28;
  const words = hint.split(/\s+/).filter((w) => w.length >= 4);
  const hits = words.filter((w) => labelLower.includes(w)).length;
  if (hits >= 2) return 20;
  if (hits === 1 && words.length === 1) return 12;
  return 0;
}

function assignmentNameHintScore(label: string, relevanceText: string): number {
  const patterns = [
    /\b(?:to|for|in)\s+(?:the\s+)?([A-Za-z0-9][^.?!?\n]{2,80}?)\s+assign/i,
    /\b(?:about|regarding)\s+(?:the\s+)?([A-Za-z0-9][^.?!?\n]{2,80}?)(?:\s+assign|\?|$)/i,
  ];
  for (const re of patterns) {
    const m = relevanceText.match(re);
    if (!m) continue;
    const hint = m[1].trim().toLowerCase();
    if (hint.length < 4) continue;
    const labelLower = label.toLowerCase();
    if (labelLower.includes(hint)) return 22;
    const hintWords = hint.split(/\s+/).filter((w) => w.length >= 4);
    const hits = hintWords.filter((w) => labelLower.includes(w)).length;
    if (hits >= 2) return 16;
    if (hits === 1 && hintWords.length === 1) return 10;
  }
  return 0;
}

export function scorePriorAssignmentLabel(label: string, relevanceText: string): number {
  const ref = relevanceText.trim();
  if (!ref || !label.trim()) return 0;
  return (
    countKeywordOverlap(label, ref) +
    unitHintScore(label, ref) +
    unitColonHintScore(label, ref) +
    assignmentNameHintScore(label, ref) +
    (hasKeywordOverlap(label, ref) ? 1 : 0)
  );
}

export type PriorSubmissionCandidate = {
  id: string;
  submitted_at: string;
  label: string;
};

/** Rank completed submissions by relevance to the student's recall question. */
export function rankPriorSubmissionCandidates(
  candidates: PriorSubmissionCandidate[],
  relevanceText: string,
  maxIds: number,
): string[] {
  if (candidates.length === 0) return [];
  const ref = relevanceText.trim();

  const scored = candidates.map((c) => ({
    ...c,
    score: ref ? scorePriorAssignmentLabel(c.label, ref) : 0,
  }));

  let withSignal = ref ? scored.filter((c) => c.score > 0) : scored;
  if (ref && /\bunit\s+\d+\s*:/i.test(ref)) {
    const unitScoped = scored.filter((c) => unitColonHintScore(c.label, ref) > 0);
    if (unitScoped.length > 0) withSignal = unitScoped;
    else return [];
  } else if (ref && /\bunit\s+\d+\b/i.test(ref)) {
    const unitScoped = scored.filter((c) => unitHintScore(c.label, ref) > 0);
    if (unitScoped.length > 0) withSignal = unitScoped;
  }
  const pool = withSignal.length > 0 ? withSignal : (ref ? [] : scored);
  if (pool.length === 0) return [];
  pool.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.submitted_at.localeCompare(a.submitted_at);
  });

  const strongMatch = pool[0]?.score >= 18 &&
    pool[0].score >= ((pool[1]?.score ?? 0) + 4);
  const take = strongMatch ? 1 : Math.min(maxIds, pool.length);
  const top = pool.slice(0, take);
  top.reverse();
  return top.map((x) => x.id);
}
