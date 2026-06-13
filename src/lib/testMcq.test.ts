import { describe, expect, it } from 'vitest';
import {
  averageMcqScores,
  deriveAllowMultipleSelections,
  formatMcqScorePercent,
  isMultiSelectMcq,
  legacySingleOptionId,
  parseOptionIds,
  scoreMcqQuestion,
  toggleOptionId,
} from './testMcq';

describe('parseOptionIds', () => {
  it('parses arrays and filters invalid entries', () => {
    expect(parseOptionIds(['a', '', 'b'])).toEqual(['a', 'b']);
  });

  it('falls back to legacy single id', () => {
    expect(parseOptionIds(null, 'x')).toEqual(['x']);
  });
});

describe('scoreMcqQuestion', () => {
  const correct = ['a', 'b', 'c'];

  it('gives full credit on exact match', () => {
    expect(scoreMcqQuestion({ correctIds: correct, selectedIds: ['a', 'b', 'c'] })).toMatchObject({
      score: 1,
      hits: 3,
      wrong: 0,
      isExactMatch: true,
    });
  });

  it('gives partial credit without wrong selections', () => {
    const result = scoreMcqQuestion({ correctIds: correct, selectedIds: ['a', 'b'] });
    expect(result.score).toBeCloseTo(2 / 3);
    expect(result.hits).toBe(2);
    expect(result.wrong).toBe(0);
  });

  it('penalizes wrong selections', () => {
    const result = scoreMcqQuestion({ correctIds: correct, selectedIds: ['a', 'b', 'c', 'd'] });
    expect(result.score).toBeCloseTo(2 / 3);
    expect(result.wrong).toBe(1);
  });

  it('returns zero when only wrong selections', () => {
    expect(scoreMcqQuestion({ correctIds: correct, selectedIds: ['d'] }).score).toBe(0);
  });
});

describe('toggleOptionId', () => {
  it('adds and removes ids immutably', () => {
    expect(toggleOptionId(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(toggleOptionId(['a', 'b'], 'a', false)).toEqual(['b']);
  });
});

describe('helpers', () => {
  it('detects multi-select mode', () => {
    expect(isMultiSelectMcq(true)).toBe(true);
    expect(isMultiSelectMcq(false)).toBe(false);
  });

  it('derives allow multiple from correct count', () => {
    expect(deriveAllowMultipleSelections(['a'])).toBe(false);
    expect(deriveAllowMultipleSelections(['a', 'b'])).toBe(true);
  });

  it('syncs legacy single id', () => {
    expect(legacySingleOptionId(['a'])).toBe('a');
    expect(legacySingleOptionId(['a', 'b'])).toBeNull();
  });

  it('formats and averages scores', () => {
    expect(formatMcqScorePercent(0.667)).toBe(67);
    expect(averageMcqScores([1, 0.5, 0])).toBeCloseTo(0.5);
  });
});
