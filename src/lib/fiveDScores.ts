import type { FiveDScores } from '@/types/models';

export const FIVE_D_DIMENSION_KEYS: (keyof FiveDScores)[] = [
  'vision',
  'values',
  'thinking',
  'connection',
  'action',
];

/** Mean of non-null dimension values. */
export function meanNonNullFiveDScores(
  scores: Partial<FiveDScores> | Record<string, number | null | undefined> | null | undefined,
): number | null {
  if (!scores) return null;
  let sum = 0;
  let n = 0;
  for (const key of FIVE_D_DIMENSION_KEYS) {
    const v = scores[key];
    if (typeof v === 'number' && !Number.isNaN(v)) {
      sum += v;
      n++;
    }
  }
  return n === 0 ? null : sum / n;
}

/** Per-dimension average across snapshots, skipping null/missing values per dimension. */
export function averageFiveDScoresAcrossSnapshots(
  snapshots: Array<{ scores: Partial<FiveDScores> | Record<string, number | null> }>,
): FiveDScores | null {
  if (snapshots.length === 0) return null;

  const totals: Record<keyof FiveDScores, number> = {
    vision: 0,
    values: 0,
    thinking: 0,
    connection: 0,
    action: 0,
  };
  const counts: Record<keyof FiveDScores, number> = {
    vision: 0,
    values: 0,
    thinking: 0,
    connection: 0,
    action: 0,
  };

  for (const snapshot of snapshots) {
    const scores = snapshot.scores as Partial<FiveDScores>;
    for (const key of FIVE_D_DIMENSION_KEYS) {
      const v = scores[key];
      if (typeof v === 'number' && !Number.isNaN(v)) {
        totals[key] += v;
        counts[key]++;
      }
    }
  }

  const result: FiveDScores = {
    vision: null,
    values: null,
    thinking: null,
    connection: null,
    action: null,
  };

  for (const key of FIVE_D_DIMENSION_KEYS) {
    if (counts[key] > 0) {
      result[key] = totals[key] / counts[key];
    }
  }

  const hasAny = FIVE_D_DIMENSION_KEYS.some((k) => result[k] !== null);
  return hasAny ? result : null;
}

/** Chart-safe numeric value (null dimensions render as 0). */
export function fiveDScoreForChart(
  scores: Partial<FiveDScores> | null | undefined,
  key: keyof FiveDScores,
): number {
  const v = scores?.[key];
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}
