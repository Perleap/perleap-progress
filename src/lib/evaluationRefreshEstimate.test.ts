import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REFRESH_CONCURRENCY,
  estimateRefreshDurationSeconds,
  estimateSecondsPerStudent,
  formatEta,
} from '@/lib/evaluationRefreshEstimate';

describe('estimateRefreshDurationSeconds', () => {
  it('returns 0 for no students', () => {
    expect(estimateRefreshDurationSeconds(0)).toBe(0);
  });

  it('estimates from student count and submission volume', () => {
    expect(estimateRefreshDurationSeconds(5, 25, 4, 28)).toBe(280);
    expect(estimateRefreshDurationSeconds(1, 3, 4, 28)).toBe(84);
    expect(estimateRefreshDurationSeconds(4, 4, 4, 28)).toBe(28);
    expect(estimateRefreshDurationSeconds(5, 5, DEFAULT_REFRESH_CONCURRENCY, 28)).toBe(56);
  });
});

describe('estimateSecondsPerStudent', () => {
  it('scales with submissions per student', () => {
    expect(estimateSecondsPerStudent(5, 25, 4, 28)).toBe(140);
    expect(estimateSecondsPerStudent(5, 5, 4, 28)).toBe(28);
  });
});

describe('formatEta', () => {
  it('formats seconds and minutes', () => {
    expect(formatEta(0)).toBe('');
    expect(formatEta(45)).toBe('~45 sec');
    expect(formatEta(60)).toBe('~1 min');
    expect(formatEta(90)).toBe('~2 min');
    expect(formatEta(180)).toBe('~3 min');
  });
});
