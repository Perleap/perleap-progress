/** Unicode em dash (U+2014); common in model output, reads as "AI-default" to many readers. */
const EM_DASH = /\u2014/g;

/**
 * Replace typographic em dashes with a spaced hyphen for student-facing chat.
 * Does not alter en dash (U+2013) to avoid breaking numeric ranges and similar.
 */
export function normalizeAssistantDashes(text: string): string {
  if (!text.includes('\u2014')) return text;
  return text.replace(EM_DASH, ' - ');
}

/**
 * Concatenate stream deltas; do not insert spaces between bare letter runs.
 * PROGRESS/marker guards only. Keep in sync with src/lib/streamTextMerge.ts.
 */
export function mergeStreamingTextChunk(prev: string, chunk: string): string {
  if (!prev || !chunk) return prev + chunk;
  if (/[<>\[\]]/.test(chunk)) return prev + chunk;
  const window = prev.slice(-24) + chunk.slice(0, 24);
  if (/<<<|PROGRESS/i.test(window)) return prev + chunk;
  return prev + chunk;
}
