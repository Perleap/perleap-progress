import { describe, expect, it } from 'vitest';
import {
  averageFiveDScoresAcrossSnapshots,
  meanNonNullFiveDScores,
  fiveDScoreForChart,
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
});
