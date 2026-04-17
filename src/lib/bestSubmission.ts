import type { FiveDScores } from '@/types/models';

const DIMENSION_KEYS: (keyof FiveDScores)[] = ['vision', 'values', 'thinking', 'connection', 'action'];

/**
 * Mean of the five soft-skill dimensions; used to compare attempts for aggregates.
 */
export function meanFiveDScore(scores: FiveDScores | null | undefined): number | null {
  if (!scores) return null;
  let sum = 0;
  let n = 0;
  for (const k of DIMENSION_KEYS) {
    const v = scores[k];
    if (typeof v === 'number' && !Number.isNaN(v)) {
      sum += v;
      n++;
    }
  }
  return n === 0 ? null : sum / n;
}

export interface SubmissionAttemptForBest {
  id: string;
  attempt_number: number;
  status: 'in_progress' | 'completed';
  submitted_at: string | null;
}

/**
 * Picks the submission id used for class/student analytics for one assignment:
 * - Among completed attempts with a snapshot score, highest mean 5D score wins.
 * - Ties: lower attempt_number (earlier attempt).
 * - If no snapshot on any completed attempt: latest completed by submitted_at.
 */
export function selectBestSubmissionIdForAggregate(
  attempts: SubmissionAttemptForBest[],
  snapshotBySubmissionId: Map<string, { scores: unknown } | null | undefined>,
): string | null {
  const completed = attempts.filter((a) => a.status === 'completed');
  if (completed.length === 0) return null;

  const scored: Array<{ id: string; score: number; attempt_number: number }> = [];
  for (const a of completed) {
    const snap = snapshotBySubmissionId.get(a.id);
    const score = meanFiveDScore(snap?.scores as FiveDScores | null);
    if (score !== null) {
      scored.push({ id: a.id, score, attempt_number: a.attempt_number });
    }
  }

  if (scored.length === 0) {
    const sorted = [...completed].sort((a, b) => {
      const ta = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const tb = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return tb - ta;
    });
    return sorted[0]?.id ?? null;
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.attempt_number - b.attempt_number;
  });
  return scored[0]?.id ?? null;
}
