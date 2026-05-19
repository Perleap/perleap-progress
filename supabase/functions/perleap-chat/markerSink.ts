/**
 * Streaming sink with a KMP-style state machine that detects a single text marker
 * (e.g. `[CONVERSATION_COMPLETE]`) without re-scanning the entire stream on every chunk.
 *
 * Usage:
 *   const sink = createMarkerSink({ marker: '[CONVERSATION_COMPLETE]',
 *     onChunk: (s) => controller.enqueue(encoder.encode(s)),
 *     onMarker: () => controller.enqueue(encoder.encode('__CONVERSATION_END__')) });
 *   sink.push('partial text...');
 *   sink.flush();
 *   const { fullText, markerHit } = sink.result();
 *
 * Semantics:
 *  - All bytes preceding the marker are forwarded to `onChunk` exactly once.
 *  - When the marker is detected, `onMarker` is called once; everything after the marker
 *    (and the marker itself) is dropped from the forwarded stream but kept out of fullText
 *    so callers can mirror the marker-stripping done by legacy logic.
 *  - `flush()` must be called at end of stream to forward any tail bytes that may have been
 *    held back as a prefix match.
 */

export interface MarkerSinkOptions {
  marker: string;
  onChunk?: (text: string) => void;
  onMarker?: () => void;
  /** Case-insensitive matching (default true). */
  caseInsensitive?: boolean;
}

export interface MarkerSink {
  push(text: string): void;
  flush(): void;
  result(): { fullText: string; markerHit: boolean };
}

export function createMarkerSink(opts: MarkerSinkOptions): MarkerSink {
  const ci = opts.caseInsensitive !== false;
  const markerNorm = ci ? opts.marker.toUpperCase() : opts.marker;
  let pending = '';
  let fullText = '';
  let markerHit = false;

  const flushSafe = (forceAll: boolean) => {
    if (markerHit) {
      pending = '';
      return;
    }
    if (!pending) return;

    const probe = ci ? pending.toUpperCase() : pending;
    const hitIdx = probe.indexOf(markerNorm);
    if (hitIdx !== -1) {
      const before = pending.slice(0, hitIdx);
      if (before) {
        fullText += before;
        opts.onChunk?.(before);
      }
      pending = '';
      markerHit = true;
      opts.onMarker?.();
      return;
    }

    if (forceAll) {
      fullText += pending;
      opts.onChunk?.(pending);
      pending = '';
      return;
    }

    // Keep the last (marker.length - 1) chars in pending in case a future chunk completes
    // the marker. Forward the rest now.
    const keep = markerNorm.length - 1;
    if (pending.length > keep) {
      const toForward = pending.slice(0, pending.length - keep);
      fullText += toForward;
      opts.onChunk?.(toForward);
      pending = pending.slice(pending.length - keep);
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
      return { fullText, markerHit };
    },
  };
}
