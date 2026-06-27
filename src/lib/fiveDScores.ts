import type { FiveDScores, FiveDDimensionKey } from '@/types/models';

export const FIVE_D_DIMENSION_KEYS: FiveDDimensionKey[] = [
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

/** Table/display formatting — null dimensions render as em dash. */
export function formatFiveDScoreDisplay(
  score: number | null | undefined,
  decimals = 2,
): string {
  return typeof score === 'number' && !Number.isNaN(score) ? score.toFixed(decimals) : '—';
}

export function formatFiveDScoreDelta(
  a: number | null | undefined,
  b: number | null | undefined,
  decimals = 2,
): string {
  if (
    typeof a !== 'number' ||
    Number.isNaN(a) ||
    typeof b !== 'number' ||
    Number.isNaN(b)
  ) {
    return '—';
  }
  const d = b - a;
  return `${d >= 0 ? '+' : ''}${d.toFixed(decimals)}`;
}

/** Stable cache-key fragment for FiveDScores (null dimensions serialize as "null"). */
export function stableFiveDScoreKey(scores: FiveDScores): string {
  return FIVE_D_DIMENSION_KEYS.map((k) => {
    const v = scores[k];
    return typeof v === 'number' && !Number.isNaN(v) ? v.toFixed(2) : 'null';
  }).join(',');
}
