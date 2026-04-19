function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Lesson text blocks store TipTap HTML. Legacy plain text (no leading tag) is wrapped for the editor.
 */
export function lessonTextBodyToHtml(body: string): string {
  const raw = body ?? '';
  if (!raw.trim()) return '';
  const trimmed = raw.trimStart();
  if (trimmed.startsWith('<')) return raw;
  return `<p>${escapeHtml(raw).replace(/\n/g, '<br>')}</p>`;
}

/** Rephrase API returns plain text — normalize to a single paragraph for TipTap. */
export function plainRephraseToLessonHtml(text: string): string {
  return lessonTextBodyToHtml(text);
}

/** Strip tags for AI rephrase input and empty checks (works without DOM). */
export function lessonHtmlToPlainText(html: string): string {
  const raw = html ?? '';
  if (!raw.trim()) return '';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
