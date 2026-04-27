/**
 * All bracketed tokens we treat as conversation-complete (uppercase for indexOf on uppercased text).
 * Primary: [CONVERSATION_COMPLETE]. Also [CONATION_COMPLETE] (common model typo: missing "VERS").
 */
const COMPLETION_MARKER_VARIANTS_UP = ['[CONVERSATION_COMPLETE]', '[CONATION_COMPLETE]'] as const;

const MAX_COMPLETION_MARKER_LEN = Math.max(
  ...COMPLETION_MARKER_VARIANTS_UP.map((m) => m.length),
);
const MARKER_PREFIX_HOLD = MAX_COMPLETION_MARKER_LEN - 1;

function findEarliestCompletionMarker(upper: string): { index: number; len: number } | null {
  let best: { index: number; len: number } | null = null;
  for (const m of COMPLETION_MARKER_VARIANTS_UP) {
    const i = upper.indexOf(m);
    if (i >= 0 && (!best || i < best.index)) {
      best = { index: i, len: m.length };
    }
  }
  return best;
}

/**
 * Remove the technical completion token from visible assistant text (case-insensitive).
 */
export function stripConversationCompleteMarker(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[(?:CONVERSATION_COMPLETE|CONATION_COMPLETE)\]/gi, '')
    .trim();
}

/**
 * Return true if raw assistant content contains the completion marker (any casing).
 */
export function hasConversationCompleteMarker(text: string): boolean {
  const upper = String(text).toUpperCase();
  return COMPLETION_MARKER_VARIANTS_UP.some((m) => upper.includes(m));
}

export interface SplitChatDisplayOptions {
  /** Cap bubble count; extra paragraphs are merged into the last bubble (full text preserved). */
  maxBubbles?: number;
}

const DEFAULT_MAX_BUBBLES = 5;

/**
 * Inserts a newline so `1)` / `1.` after punctuation starts on its own line (GFM can parse
 * a following ordered list).
 */
function runInOneAfterPunctuation(s: string): string {
  return s.replace(
    /([:;?!.])(\s+)(1)([.)]\s+)/g,
    (_, punct: string, _spaces: string, one: string, rest: string) => `${punct}\n${one}${rest}`,
  );
}

/**
 * If the text has an ordered list that starts with `1)` (start of line or after run-in) and
 * uses consecutive numbers, replace the spaces before `2)`,`3)`,… with newlines. Does nothing
 * when the paragraph does not look like a `1)…2)…` list.
 */
function splitConsecutiveNumberedMarkersInListContext(s: string): string {
  const listContext =
    /(?:^|\n)\s*1[.)]\s/.test(s) || /[:;?!.]\s*\n\s*1[.)]\s/.test(s);
  if (!listContext) return s;

  const re = /(\d+)([.)]\s+)/g;
  const found: { index: number; n: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    found.push({ index: m.index, n: +m[1] });
  }
  if (found.length < 2) return s;

  const ranges: { start: number; end: number }[] = [];
  for (let i = 0; i < found.length - 1; i++) {
    if (found[i + 1].n !== found[i].n + 1) continue;
    const j = found[i + 1].index;
    let k = j;
    while (k > 0 && s[k - 1] === ' ') {
      k--;
    }
    if (k < j) ranges.push({ start: k, end: j });
  }
  if (ranges.length === 0) return s;

  ranges.sort((a, b) => b.start - a.start);
  let out = s;
  for (const { start, end } of ranges) {
    out = out.slice(0, start) + '\n' + out.slice(end);
  }
  return out;
}

/**
 * Newline before a bullet that immediately follows `:` or `;` (run-in list intro).
 * Avoids `**` (bold) by requiring a single `*` followed by space.
 */
function runInBulletAfterPunctuation(s: string): string {
  let t = s.replace(/([:;])\s*(-\s+)/g, '$1\n$2');
  t = t.replace(/([:;])\s*(\* )/g, '$1\n$2');
  t = t.replace(/([:;])\s*(•\s*)/g, '$1\n$2');
  return t;
}

/**
 * Display-only: rewrite chat message text so inline numbered/bullet lists are likely to
 * render as real Markdown lists in {@link splitChatDisplayText} + SafeMathMarkdown.
 * Does not modify stored conversation JSON.
 *
 * - After `: ; ? ! .` — optional spaces — `1) ` or `1. `, inserts a newline before `1` so
 *   the first item can start a GFM list.
 * - In a `1)…2)…` list context, inserts newlines only between **consecutive** numbers
 *   (`1→2→3…`) to avoid splittings like "version 1) and 2)" when there is no leading `1)`.
 * - After `:` or `;` — optional spaces — `- `, `* `, or `•` — inserts a newline before the bullet.
 */
export function formatInlineListsForChatMarkdown(input: string): string {
  if (!input) return input;

  return input
    .split(/\n{2,}/)
    .map((para) => {
      let t = runInOneAfterPunctuation(para.trim());
      t = splitConsecutiveNumberedMarkersInListContext(t);
      t = runInBulletAfterPunctuation(t);
      return t;
    })
    .join('\n\n');
}

/**
 * Display-only split of the exact assistant string: paragraph breaks and one optional first
 * single-newline break. Does not split on every sentence.
 */
export function splitChatDisplayText(
  text: string,
  options?: SplitChatDisplayOptions,
): string[] {
  const maxB = options?.maxBubbles ?? DEFAULT_MAX_BUBBLES;
  const raw = (text || '').trim();
  if (!raw) return [];

  const paragraphs = raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  let segments: string[] = [];

  if (paragraphs.length > 1) {
    segments = paragraphs;
  } else {
    const block = paragraphs[0] || raw;
    const nl = block.indexOf('\n');
    if (nl > 0 && nl < block.length - 1) {
      const head = block.slice(0, nl).trim();
      const tail = block.slice(nl + 1).trim();
      if (head && tail) {
        segments = [head, tail];
      } else {
        segments = [block];
      }
    } else {
      segments = [block];
    }
  }

  if (segments.length <= maxB) {
    return segments;
  }
  const out = segments.slice(0, maxB);
  out[maxB - 1] = segments.slice(maxB - 1).join('\n\n');
  return out;
}

/**
 * State for incrementally emitting stream text while hiding a marker that may be split across chunks.
 */
export function createChatStreamEmission() {
  let raw = '';
  let emitted = 0;
  let shouldEnd = false;

  const feed = (newText: string, onToken: (s: string) => void) => {
    raw += newText;
    for (;;) {
      const upper = raw.toUpperCase();
      const match = findEarliestCompletionMarker(upper);
      if (match) {
        const { index: mi, len: markerLen } = match;
        const part = raw.slice(emitted, mi);
        if (part) onToken(part);
        shouldEnd = true;
        raw = raw.slice(mi + markerLen);
        emitted = 0;
        continue;
      }
      if (raw.length - emitted > MARKER_PREFIX_HOLD) {
        const end = raw.length - MARKER_PREFIX_HOLD;
        const part = raw.slice(emitted, end);
        if (part) onToken(part);
        emitted = end;
      }
      break;
    }
  };

  const end = (onToken: (s: string) => void) => {
    const upper = raw.toUpperCase();
    const found = findEarliestCompletionMarker(upper);
    if (found) {
      const part = raw.slice(emitted, found.index);
      if (part) onToken(part);
      shouldEnd = true;
    } else if (emitted < raw.length) {
      const tail = raw.slice(emitted);
      if (hasConversationCompleteMarker(tail)) {
        shouldEnd = true;
      }
      const cleaned = stripConversationCompleteMarker(tail);
      if (cleaned) onToken(cleaned);
    }
  };

  return { feed, end, getShouldEnd: () => shouldEnd };
}
