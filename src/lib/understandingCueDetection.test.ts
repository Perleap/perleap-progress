import { describe, it, expect } from 'vitest';
import { detectUnderstandingCue } from './understandingCueDetection';

describe('detectUnderstandingCue', () => {
  it('detects English confusion', () => {
    const r = detectUnderstandingCue("I don't understand step 3");
    expect(r.hit).toBe(true);
    expect(r.reasonCodes.length).toBeGreaterThan(0);
  });

  it('detects casual English (no apostrophe, fragment phrasing)', () => {
    expect(detectUnderstandingCue('i dont know what this mean').hit).toBe(true);
  });

  it('detects direct explain request', () => {
    expect(detectUnderstandingCue('explain this to me').hit).toBe(true);
  });

  it('detects Hebrew', () => {
    const r = detectUnderstandingCue('לא הבנתי מה לעשות כאן');
    expect(r.hit).toBe(true);
  });

  it('avoids flagging neutral long academic text without cues', () => {
    const r = detectUnderstandingCue(
      'The treaty of 1815 established trade routes and fiscal policy across the region for several decades.',
    );
    expect(r.hit).toBe(false);
  });
});
