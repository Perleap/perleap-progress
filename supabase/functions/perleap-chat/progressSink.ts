/**
 * Streaming sink that detects the hidden `<<<PROGRESS:[indexes]>>>` marker the model appends
 * at the end of every reply (see PROGRESS_EMISSION in `perleapChatCompletionRules.ts`).
 *
 * The marker is variable-length (`[1,2]`, `[]`, `[1, 2, 3]`), so we can't use a fixed-string
 * KMP like `markerSink.ts`. Instead we:
 *   1. Buffer recent bytes (up to the prefix length).
 *   2. When the literal `<<<PROGRESS:` prefix appears, hold from that point onward until the
 *      closing `>>>` arrives (or until `flush()`, whichever first).
 *   3. On full match, parse the comma-separated integer array, strip the marker (and any
 *      trailing whitespace immediately preceding it) from the forwarded stream, and call
 *      `onProgress` exactly once.
 *
 * Semantics mirror `markerSink.ts`:
 *   - All bytes preceding the marker are forwarded to `onChunk` exactly once.
 *   - `fullText` accumulates exactly what was forwarded (marker stripped).
 *   - `flush()` must be called at end of stream to release any held tail bytes.
 */

const PROGRESS_PREFIX = '<<<PROGRESS:';
const PROGRESS_FULL_RE = /<<<PROGRESS:\s*\[([^\]]*)\]>>>/;
const KEEP_TAIL = PROGRESS_PREFIX.length - 1;

export interface ProgressSinkOptions {
  onChunk?: (text: string) => void;
  onProgress?: (indexes: number[]) => void;
}

export interface ProgressSink {
  push(text: string): void;
  flush(): void;
  result(): { fullText: string; markerHit: boolean; indexes: number[] };
}

function parseIndexArray(raw: string): number[] {
  if (!raw.trim()) return [];
  const out: number[] = [];
  for (const part of raw.split(',')) {
    const n = parseInt(part.trim(), 10);
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return [...new Set(out)];
}

export function createProgressSink(opts: ProgressSinkOptions): ProgressSink {
  let pending = '';
  let fullText = '';
  let markerHit = false;
  let indexes: number[] = [];

  const forward = (chunk: string) => {
    if (!chunk) return;
    fullText += chunk;
    opts.onChunk?.(chunk);
  };

  const flushSafe = (force: boolean) => {
    if (markerHit) {
      pending = '';
      return;
    }
    if (!pending) return;

    const startIdx = pending.indexOf(PROGRESS_PREFIX);

    if (startIdx !== -1) {
      const remainder = pending.slice(startIdx);
      const match = remainder.match(PROGRESS_FULL_RE);
      if (match && match.index !== undefined && match.index === 0) {
        const before = pending.slice(0, startIdx).replace(/\s+$/g, '');
        forward(before);
        indexes = parseIndexArray(match[1]);
        markerHit = true;
        opts.onProgress?.(indexes);
        pending = '';
        return;
      }
      if (force) {
        // No terminator before stream end -> treat the partial as ordinary text.
        forward(pending);
        pending = '';
        return;
      }
      // Hold from prefix onward; forward whatever preceded it.
      const before = pending.slice(0, startIdx);
      forward(before);
      pending = pending.slice(startIdx);
      return;
    }

    if (force) {
      forward(pending);
      pending = '';
      return;
    }

    // No prefix anywhere; keep last KEEP_TAIL chars in case the prefix is split across chunks.
    if (pending.length > KEEP_TAIL) {
      const toForward = pending.slice(0, pending.length - KEEP_TAIL);
      forward(toForward);
      pending = pending.slice(pending.length - KEEP_TAIL);
    }
  };

  return {
    push(text: string) {
      if (markerHit || !text) return;
      pending += text;
      flushSafe(false);
    },
    flush() {
      flushSafe(true);
    },
    result() {
      return { fullText, markerHit, indexes };
    },
  };
}

/**
 * One-shot parser for non-streaming code paths. Strips the marker (and any whitespace
 * immediately preceding it) from `text` and returns the clean text + parsed indexes.
 */
export function extractProgressFromFullText(text: string): { cleaned: string; indexes: number[] } {
  if (typeof text !== 'string' || !text) return { cleaned: text ?? '', indexes: [] };
  const match = text.match(PROGRESS_FULL_RE);
  if (!match || match.index === undefined) return { cleaned: text, indexes: [] };
  const before = text.slice(0, match.index).replace(/\s+$/g, '');
  const after = text.slice(match.index + match[0].length);
  const cleaned = (before + after).trimEnd();
  return { cleaned, indexes: parseIndexArray(match[1]) };
}
