/**
 * Cheap, deterministic topic-overlap helpers.
 *
 * Used to decide whether a prior-context chunk or a classroom-wide
 * <course_materials> block is on-topic for the current assignment.
 * No LLM calls, no external state - pure string ops.
 *
 * Rules:
 *  - Lowercase, split on non-alphanumeric and non-Hebrew letters.
 *  - Drop a small built-in stop-word list (en + he).
 *  - Keep tokens of length >= 4, plus any digit-bearing token of length >= 1.
 *  - Two texts "overlap" when their keyword sets share >= `min` items.
 */

const STOP_WORDS_EN = new Set<string>([
  'about', 'above', 'after', 'again', 'against', 'also', 'although', 'always',
  'among', 'around', 'because', 'been', 'before', 'being', 'below', 'between',
  'both', 'cannot', 'could', 'does', 'doing', 'done', 'down', 'during', 'each',
  'either', 'else', 'even', 'ever', 'every', 'from', 'further', 'going', 'gone',
  'have', 'having', 'here', 'hers', 'herself', 'himself', 'into', 'itself',
  'just', 'like', 'more', 'most', 'much', 'must', 'never', 'next', 'none',
  'nope', 'once', 'only', 'other', 'others', 'ought', 'over', 'same', 'shall',
  'should', 'since', 'some', 'such', 'than', 'that', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'thus', 'together', 'under', 'until', 'upon', 'used', 'using', 'very',
  'want', 'wants', 'were', 'what', 'when', 'where', 'which', 'while', 'whom',
  'will', 'with', 'within', 'without', 'would', 'your', 'yours', 'yourself',
  // chat-noise
  'assistant', 'student', 'great', 'good', 'okay', 'yes', 'thanks', 'submitted',
  'written', 'work', 'prior', 'assignment', 'task', 'tasks', 'session', 'lesson',
  'hello', 'please', 'response', 'responses', 'selected',
]);

// Common Hebrew function words. Short by design - we only need to suppress noise,
// not build a full linguistic stop list.
const STOP_WORDS_HE = new Set<string>([
  'אבל', 'איך', 'אינו', 'אנחנו', 'אני', 'אנא', 'אתה', 'אתם', 'אתן', 'בכל',
  'בלי', 'גם', 'הוא', 'היא', 'היה', 'היתה', 'הם', 'הן', 'זה', 'זאת', 'יש',
  'כאן', 'כאשר', 'כדי', 'כי', 'כך', 'כל', 'לא', 'לכן', 'מה', 'מי', 'מתי',
  'נא', 'עוד', 'על', 'עם', 'של', 'שלך', 'שלי', 'שלנו', 'תלמיד', 'תלמידה',
  'מטלה', 'משימה', 'תרגיל', 'מורה', 'שלום',
]);

const TOKEN_SPLIT_RE = /[^a-z0-9\u0590-\u05ff]+/gi;

/**
 * Extract a keyword set from a piece of text.
 * Returns lowercased tokens; keeps tokens with digits even if very short
 * (numbers and digit-token IDs carry strong topical signal).
 */
export function extractKeywordSet(text: string): Set<string> {
  const out = new Set<string>();
  if (!text) return out;
  const lowered = String(text).toLowerCase();
  const raw = lowered.split(TOKEN_SPLIT_RE);
  for (const tok of raw) {
    if (!tok) continue;
    const hasDigit = /\d/.test(tok);
    if (!hasDigit && tok.length < 4) continue;
    if (STOP_WORDS_EN.has(tok)) continue;
    if (STOP_WORDS_HE.has(tok)) continue;
    out.add(tok);
  }
  return out;
}

/**
 * Returns true when `a` and `b` share at least `min` keywords.
 * If either side has zero keywords, returns false (can't be on-topic without signal).
 */
/** Count shared keywords between two texts (for ranking, not gating). */
export function countKeywordOverlap(a: string, b: string): number {
  const ka = extractKeywordSet(a);
  const kb = extractKeywordSet(b);
  if (ka.size === 0 || kb.size === 0) return 0;
  let hits = 0;
  const [small, large] = ka.size <= kb.size ? [ka, kb] : [kb, ka];
  for (const w of small) {
    if (large.has(w)) hits++;
  }
  return hits;
}

export function hasKeywordOverlap(a: string, b: string, min = 1): boolean {
  const ka = extractKeywordSet(a);
  const kb = extractKeywordSet(b);
  if (ka.size === 0 || kb.size === 0) return false;
  let hits = 0;
  // Iterate the smaller set for speed.
  const [small, large] = ka.size <= kb.size ? [ka, kb] : [kb, ka];
  for (const w of small) {
    if (large.has(w)) {
      hits++;
      if (hits >= min) return true;
    }
  }
  return false;
}

/**
 * Return up to `limit` keywords from `text` that also appear in `assignmentKeywords`.
 * Used to build a short topical summary for compressed prior submissions.
 */
export function overlappingKeywords(
  text: string,
  assignmentKeywords: Set<string>,
  limit = 3,
): string[] {
  if (assignmentKeywords.size === 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const lowered = String(text ?? '').toLowerCase();
  const raw = lowered.split(TOKEN_SPLIT_RE);
  for (const tok of raw) {
    if (!tok || seen.has(tok)) continue;
    if (!assignmentKeywords.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
    if (out.length >= limit) break;
  }
  return out;
}
