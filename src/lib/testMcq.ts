export interface McqScoreResult {
  score: number;
  hits: number;
  misses: number;
  wrong: number;
  isExactMatch: boolean;
}

export function parseOptionIds(
  value: unknown,
  legacySingleId?: string | null,
): string[] {
  if (Array.isArray(value)) {
    return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  if (legacySingleId) {
    return [legacySingleId];
  }
  return [];
}

export function isMultiSelectMcq(allowMultipleSelections: boolean | null | undefined): boolean {
  return allowMultipleSelections === true;
}

export function toggleOptionId(ids: string[], optionId: string, checked: boolean): string[] {
  if (checked) {
    return ids.includes(optionId) ? ids : [...ids, optionId];
  }
  return ids.filter((id) => id !== optionId);
}

export function scoreMcqQuestion({
  correctIds,
  selectedIds,
}: {
  correctIds: string[];
  selectedIds: string[];
}): McqScoreResult {
  const correctSet = new Set(correctIds);
  const selectedSet = new Set(selectedIds);

  if (correctSet.size === 0) {
    return { score: 0, hits: 0, misses: 0, wrong: 0, isExactMatch: false };
  }

  let hits = 0;
  let wrong = 0;

  for (const id of selectedSet) {
    if (correctSet.has(id)) hits++;
    else wrong++;
  }

  const misses = correctSet.size - hits;
  const isExactMatch =
    hits === correctSet.size && wrong === 0 && selectedSet.size === correctSet.size;
  const score = isExactMatch ? 1 : Math.max(0, (hits - wrong) / correctSet.size);

  return { score, hits, misses, wrong, isExactMatch };
}

/** Sync legacy single-id column when persisting array answers. */
export function legacySingleOptionId(ids: string[]): string | null {
  return ids.length === 1 ? ids[0] : null;
}

export function deriveAllowMultipleSelections(correctIds: string[]): boolean {
  return correctIds.length > 1;
}

export function formatMcqScorePercent(score: number): number {
  return Math.round(score * 100);
}

export function averageMcqScores(scores: number[]): number {
  if (scores.length === 0) return 0;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}
