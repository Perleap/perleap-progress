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
