import { describe, expect, it } from 'vitest';
import {
  averageFiveDScoresAcrossSnapshots,
  meanNonNullFiveDScores,
  fiveDScoreForChart,
  stableFiveDScoresKey,
  formatFiveDScoreDisplay,
} from './fiveDScores';

describe('fiveDScores', () => {
  it('meanNonNullFiveDScores skips null dimensions', () => {
    expect(
      meanNonNullFiveDScores({
        vision: null,
        values: 4,
        thinking: 8,
        connection: null,
        action: 6,
      }),
    ).toBe(6);
  });

  it('averageFiveDScoresAcrossSnapshots averages per dimension independently', () => {
    const avg = averageFiveDScoresAcrossSnapshots([
      { scores: { vision: 4, values: null, thinking: 6, connection: null, action: 8 } },
      { scores: { vision: 8, values: 6, thinking: null, connection: 4, action: null } },
    ]);
    expect(avg?.vision).toBe(6);
    expect(avg?.values).toBe(6);
    expect(avg?.thinking).toBe(6);
    expect(avg?.connection).toBe(4);
    expect(avg?.action).toBe(8);
  });

  it('fiveDScoreForChart returns 0 for null', () => {
    expect(fiveDScoreForChart({ vision: null, values: 5, thinking: 5, connection: 5, action: 5 }, 'vision')).toBe(0);
  });

  it('stableFiveDScoresKey does not throw when dimensions are null', () => {
    expect(
      stableFiveDScoresKey({
        vision: 7.5,
        values: null,
        thinking: 6,
        connection: null,
        action: 8,
      }),
    ).toBe('7.50,null,6.00,null,8.00');
    expect(stableFiveDScoresKey(null)).toBe('no-scores');
  });

  it('formatFiveDScoreDisplay renders em dash for null', () => {
    expect(formatFiveDScoreDisplay(null)).toBe('—');
    expect(formatFiveDScoreDisplay(6.25, 2)).toBe('6.25');
  });
});
