import { describe, expect, it } from 'vitest';
import { meanFiveDScore, selectBestSubmissionIdForAggregate } from './bestSubmission';

const base = { vision: 5, values: 5, thinking: 5, connection: 5, action: 5 };

describe('meanFiveDScore', () => {
  it('returns mean of five dimensions', () => {
    expect(meanFiveDScore({ ...base, vision: 10 })).toBe(6);
  });

  it('returns null for empty scores', () => {
    expect(meanFiveDScore(null)).toBeNull();
  });
});

describe('selectBestSubmissionIdForAggregate', () => {
  it('returns null when no completed attempts', () => {
    expect(
      selectBestSubmissionIdForAggregate(
        [{ id: 'a', attempt_number: 1, status: 'in_progress', submitted_at: null }],
        new Map(),
      ),
    ).toBeNull();
  });

  it('picks higher-rated submission', () => {
    const attempts = [
      { id: 's1', attempt_number: 1, status: 'completed' as const, submitted_at: '2025-01-01T00:00:00Z' },
      { id: 's2', attempt_number: 2, status: 'completed' as const, submitted_at: '2025-01-02T00:00:00Z' },
    ];
    const map = new Map([
      ['s1', { scores: { ...base, vision: 4 } }],
      ['s2', { scores: { ...base, vision: 8 } }],
    ]);
    expect(selectBestSubmissionIdForAggregate(attempts, map)).toBe('s2');
  });

  it('breaks ties with lower attempt_number', () => {
    const attempts = [
      { id: 's1', attempt_number: 1, status: 'completed' as const, submitted_at: '2025-01-01T00:00:00Z' },
      { id: 's2', attempt_number: 2, status: 'completed' as const, submitted_at: '2025-01-02T00:00:00Z' },
    ];
    const map = new Map([
      ['s1', { scores: { ...base } }],
      ['s2', { scores: { ...base } }],
    ]);
    expect(selectBestSubmissionIdForAggregate(attempts, map)).toBe('s1');
  });

  it('with no ratings, picks latest completed', () => {
    const attempts = [
      { id: 's1', attempt_number: 1, status: 'completed' as const, submitted_at: '2025-01-01T00:00:00Z' },
      { id: 's2', attempt_number: 2, status: 'completed' as const, submitted_at: '2025-01-03T00:00:00Z' },
    ];
    const map = new Map<string, { scores: unknown } | null | undefined>();
    expect(selectBestSubmissionIdForAggregate(attempts, map)).toBe('s2');
  });
});
