import type { TranscriptionSegment } from './openai.ts';

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

const MAX_OUTLINE_CHARS = 12000;
const TARGET_SAMPLED_LINES = 180;

export function buildSummaryOutline(
  segments: TranscriptionSegment[],
  durationSeconds: number | null,
): { outline: string; sessionEnd: number } {
  const segmentEndMax =
    segments.length > 0 ? Math.max(...segments.map((s) => s.end)) : 0;
  const sessionEnd =
    durationSeconds && durationSeconds > 0
      ? Math.max(durationSeconds, segmentEndMax)
      : segmentEndMax;

  const header = `Total session duration: ${formatTime(sessionEnd)} (${sessionEnd}s)\n`;

  if (segments.length === 0) {
    return { outline: header, sessionEnd };
  }

  const lines = segments.map((s) => `[${formatTime(s.start)}] ${s.text.trim()}`);
  const fullText = lines.join('\n');

  if (fullText.length + header.length <= MAX_OUTLINE_CHARS) {
    return { outline: header + fullText, sessionEnd };
  }

  const targetLines = Math.min(TARGET_SAMPLED_LINES, segments.length);
  const sampled: string[] = [];

  for (let i = 0; i < targetLines; i++) {
    const idx = Math.min(segments.length - 1, Math.floor((i * segments.length) / targetLines));
    const seg = segments[idx];
    sampled.push(`[${formatTime(seg.start)}] ${seg.text.trim()}`);
  }

  let body = sampled.join('\n');
  if (body.length + header.length > MAX_OUTLINE_CHARS) {
    body = body.slice(0, MAX_OUTLINE_CHARS - header.length);
  }

  return { outline: header + body, sessionEnd };
}

export function buildSummaryPrompt(langLabel: string, sessionEnd: number): string {
  return `You are summarizing a recorded teaching session for the teacher who ran it.
Using the timestamped transcript, produce a concise summary and a list of key moments.

The full recording is ${sessionEnd} seconds (${formatTime(sessionEnd)}). Key moments must reflect the ENTIRE session, not only the opening.

Respond in ${langLabel} as JSON:
{
  "summary": "A concise 4-8 sentence summary of what happened in the session.",
  "timestamps": [
    { "time": number_of_seconds_from_start, "label": "Short description of this moment" }
  ]
}

Rules:
- Respond in ${langLabel}.
- Pick 5-10 meaningful key moments spread across the full ${formatTime(sessionEnd)} session.
- Include at least one moment in the second half of the session and at least one in the final third.
- "time" must be an integer from 0 to ${sessionEnd}, taken from the [m:ss] markers in the transcript.
- Keep labels short (a few words).`;
}

export function parseKeyMoments(
  raw: unknown,
  sessionEnd: number,
): Array<{ time: number; label: string }> {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((tp: unknown) => tp && typeof tp === 'object')
    .map((tp: { time?: unknown; label?: unknown }) => ({
      time: Math.max(0, Math.min(sessionEnd, Math.floor(Number(tp.time) || 0))),
      label: String(tp.label ?? '').trim(),
    }))
    .filter((tp: { label: string }) => tp.label.length > 0);
}

export function buildFallbackKeyMoments(
  segments: TranscriptionSegment[],
  sessionEnd: number,
  count = 8,
): Array<{ time: number; label: string }> {
  if (segments.length === 0 || sessionEnd <= 0) return [];

  const moments: Array<{ time: number; label: string }> = [];
  for (let i = 0; i < count; i++) {
    const targetTime = Math.floor((sessionEnd * (i + 1)) / (count + 1));
    const nearest = segments.reduce((best, seg) => {
      const dist = Math.abs(seg.start - targetTime);
      const bestDist = Math.abs(best.start - targetTime);
      return dist < bestDist ? seg : best;
    }, segments[0]);
    const label = nearest.text.trim().slice(0, 48) || `Moment ${i + 1}`;
    moments.push({ time: Math.floor(nearest.start), label });
  }

  return moments;
}

export function keyMomentsCoverSession(
  timestamps: Array<{ time: number }>,
  sessionEnd: number,
): boolean {
  if (sessionEnd <= 600 || timestamps.length === 0) return true;
  const maxTime = Math.max(...timestamps.map((t) => t.time));
  return maxTime >= sessionEnd * 0.4;
}
