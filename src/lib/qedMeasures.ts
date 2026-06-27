import type { Json } from '@/integrations/supabase/types';
import type {
  FiveDDimensionKey,
  FiveDDimensionQedMeasures,
  FiveDQedMeasures,
} from '@/types/models';
import { FIVE_D_DIMENSION_KEYS } from '@/lib/fiveDScores';

export type QedLayerKey = 'development' | 'motivation';

export const QED_LAYER_KEYS: QedLayerKey[] = ['development', 'motivation'];

export function emptyFiveDQedMeasures(): FiveDQedMeasures {
  const emptyDim: FiveDDimensionQedMeasures = {
    development: null,
    motivation: null,
    phase: null,
    next: null,
  };
  return {
    vision: { ...emptyDim },
    values: { ...emptyDim },
    thinking: { ...emptyDim },
    connection: { ...emptyDim },
    action: { ...emptyDim },
  };
}

function parseDimensionQed(raw: unknown): FiveDDimensionQedMeasures {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { development: null, motivation: null, phase: null, next: null };
  }
  const o = raw as Record<string, unknown>;
  const development =
    typeof o.development === 'number' && Number.isFinite(o.development)
      ? Math.min(100, Math.max(1, Math.round(o.development)))
      : null;
  const motivation =
    typeof o.motivation === 'number' && Number.isFinite(o.motivation)
      ? Math.min(100, Math.max(1, Math.round(o.motivation)))
      : null;
  const phase = o.phase === 'up' || o.phase === 'down' ? o.phase : null;
  const next = typeof o.next === 'string' && o.next.trim() ? o.next.trim() : null;
  return { development, motivation, phase, next };
}

/** Parse qed_measures JSON from DB. Returns null if missing or empty. */
export function parseQedMeasures(j: Json | null | undefined): FiveDQedMeasures | null {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
  const o = j as Record<string, unknown>;
  const result = emptyFiveDQedMeasures();
  let hasAny = false;
  for (const key of FIVE_D_DIMENSION_KEYS) {
    const dim = parseDimensionQed(o[key]);
    result[key] = dim;
    if (
      dim.development !== null ||
      dim.motivation !== null ||
      dim.phase !== null ||
      dim.next !== null
    ) {
      hasAny = true;
    }
  }
  return hasAny ? result : null;
}

/** Chart axis value on 0–100 scale (QED measures are already 1–100). */
export function qedMeasureToChartValue(measure: number | null | undefined): number | null {
  if (measure === null || measure === undefined || Number.isNaN(measure)) return null;
  return measure;
}

/** Map legacy 0–10 FiveD score to 0–100 chart axis. */
export function fiveDScoreToChartValue(score: number | null | undefined): number | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  return score * 10;
}

/** True when at least one dimension has structured motivation data. */
export function hasDualLayerQedData(qed: FiveDQedMeasures | null | undefined): boolean {
  if (!qed) return false;
  return FIVE_D_DIMENSION_KEYS.some((k) => qed[k].motivation !== null);
}

/** True when at least one dimension has development or motivation. */
export function hasAnyQedLayerData(qed: FiveDQedMeasures | null | undefined): boolean {
  if (!qed) return false;
  return FIVE_D_DIMENSION_KEYS.some(
    (k) => qed[k].development !== null || qed[k].motivation !== null,
  );
}

export function getLayerChartValue(
  qed: FiveDQedMeasures | null | undefined,
  dimension: FiveDDimensionKey,
  layer: QedLayerKey,
  fallbackScore: number | null | undefined,
): number | null {
  const dim = qed?.[dimension];
  if (layer === 'development') {
    if (dim?.development != null) return qedMeasureToChartValue(dim.development);
    if (typeof fallbackScore === 'number' && !Number.isNaN(fallbackScore)) {
      return fiveDScoreToChartValue(fallbackScore);
    }
    return null;
  }
  if (dim?.motivation != null) return qedMeasureToChartValue(dim.motivation);
  return null;
}

type SnapshotWithQed = { qed_measures?: Json | null };

/** Average D and M per dimension independently across snapshots. */
export function averageQedMeasuresAcrossSnapshots(
  snapshots: SnapshotWithQed[],
): FiveDQedMeasures | null {
  if (snapshots.length === 0) return null;

  const totals: Record<FiveDDimensionKey, { development: number; motivation: number }> = {
    vision: { development: 0, motivation: 0 },
    values: { development: 0, motivation: 0 },
    thinking: { development: 0, motivation: 0 },
    connection: { development: 0, motivation: 0 },
    action: { development: 0, motivation: 0 },
  };
  const counts: Record<FiveDDimensionKey, { development: number; motivation: number }> = {
    vision: { development: 0, motivation: 0 },
    values: { development: 0, motivation: 0 },
    thinking: { development: 0, motivation: 0 },
    connection: { development: 0, motivation: 0 },
    action: { development: 0, motivation: 0 },
  };

  for (const snap of snapshots) {
    const qed = parseQedMeasures(snap.qed_measures ?? null);
    if (!qed) continue;
    for (const key of FIVE_D_DIMENSION_KEYS) {
      const d = qed[key].development;
      const m = qed[key].motivation;
      if (d !== null) {
        totals[key].development += d;
        counts[key].development++;
      }
      if (m !== null) {
        totals[key].motivation += m;
        counts[key].motivation++;
      }
    }
  }

  const result = emptyFiveDQedMeasures();
  let hasAny = false;
  for (const key of FIVE_D_DIMENSION_KEYS) {
    if (counts[key].development > 0) {
      result[key].development = Math.round(totals[key].development / counts[key].development);
      hasAny = true;
    }
    if (counts[key].motivation > 0) {
      result[key].motivation = Math.round(totals[key].motivation / counts[key].motivation);
      hasAny = true;
    }
  }
  return hasAny ? result : null;
}
