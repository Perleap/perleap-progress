import type { Analytics5dNarrativeResult } from '@/services/analytics5dExplainService';
import type { FiveDScores } from '@/types/models';

export type LessonBriefClassNarrativeSnapshot = {
  classAverage: FiveDScores;
  narrative: Analytics5dNarrativeResult;
  evidenceSourceCount: number;
  filterSummary: string;
  cachedAt: number;
};

const STORAGE_PREFIX = 'perleap:lesson-brief:class-narrative:';

function cacheKey(classroomId: string, module: string, assignment: string): string {
  return `${STORAGE_PREFIX}${classroomId}:${module}:${assignment}`;
}

export function setLessonBriefClassNarrativeCache(
  classroomId: string,
  module: string,
  assignment: string,
  snapshot: LessonBriefClassNarrativeSnapshot,
): void {
  try {
    sessionStorage.setItem(cacheKey(classroomId, module, assignment), JSON.stringify(snapshot));
  } catch {
    // Ignore quota / private-mode errors
  }
}

export function getLessonBriefClassNarrativeCache(
  classroomId: string,
  module: string,
  assignment: string,
): LessonBriefClassNarrativeSnapshot | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(classroomId, module, assignment));
    if (!raw) return null;
    return JSON.parse(raw) as LessonBriefClassNarrativeSnapshot;
  } catch {
    return null;
  }
}
