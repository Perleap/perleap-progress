import type { Analytics5dNarrativeResult } from '@/services/analytics5dExplainService';
import type { FiveDScores } from '@/types/models';

export type LessonBriefClassNarrativeSnapshot = {
  classAverage: FiveDScores;
  narrative: Analytics5dNarrativeResult;
  evidenceSourceCount: number;
  filterSummary: string;
  cachedAt: number;
};

export type LessonBriefStudentNarrativeEntry = {
  studentId: string;
  narrative: Analytics5dNarrativeResult | null;
};

export type LessonBriefStudentNarrativesSnapshot = {
  narratives: LessonBriefStudentNarrativeEntry[];
  cachedAt: number;
};

export type LessonBriefPreloadStatus = 'loading' | 'ready' | 'error';

const CLASS_STORAGE_PREFIX = 'perleap:lesson-brief:class-narrative:';
const STUDENT_STORAGE_PREFIX = 'perleap:lesson-brief:student-narratives:';
const PRELOAD_STATUS_PREFIX = 'perleap:lesson-brief:preload-status:';

function scopeKey(classroomId: string, module: string, assignment: string): string {
  return `${classroomId}:${module}:${assignment}`;
}

function classCacheKey(classroomId: string, module: string, assignment: string): string {
  return `${CLASS_STORAGE_PREFIX}${scopeKey(classroomId, module, assignment)}`;
}

function studentCacheKey(classroomId: string, module: string, assignment: string): string {
  return `${STUDENT_STORAGE_PREFIX}${scopeKey(classroomId, module, assignment)}`;
}

function preloadStatusKey(classroomId: string, module: string, assignment: string): string {
  return `${PRELOAD_STATUS_PREFIX}${scopeKey(classroomId, module, assignment)}`;
}

export function setLessonBriefClassNarrativeCache(
  classroomId: string,
  module: string,
  assignment: string,
  snapshot: LessonBriefClassNarrativeSnapshot,
): void {
  try {
    sessionStorage.setItem(classCacheKey(classroomId, module, assignment), JSON.stringify(snapshot));
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
    const raw = sessionStorage.getItem(classCacheKey(classroomId, module, assignment));
    if (!raw) return null;
    return JSON.parse(raw) as LessonBriefClassNarrativeSnapshot;
  } catch {
    return null;
  }
}

export function setLessonBriefStudentNarrativesCache(
  classroomId: string,
  module: string,
  assignment: string,
  snapshot: LessonBriefStudentNarrativesSnapshot,
): void {
  try {
    sessionStorage.setItem(studentCacheKey(classroomId, module, assignment), JSON.stringify(snapshot));
  } catch {
    // Ignore quota / private-mode errors
  }
}

export function getLessonBriefStudentNarrativesCache(
  classroomId: string,
  module: string,
  assignment: string,
): LessonBriefStudentNarrativesSnapshot | null {
  try {
    const raw = sessionStorage.getItem(studentCacheKey(classroomId, module, assignment));
    if (!raw) return null;
    return JSON.parse(raw) as LessonBriefStudentNarrativesSnapshot;
  } catch {
    return null;
  }
}

export function setLessonBriefPreloadStatus(
  classroomId: string,
  module: string,
  assignment: string,
  status: LessonBriefPreloadStatus,
): void {
  try {
    sessionStorage.setItem(preloadStatusKey(classroomId, module, assignment), status);
  } catch {
    // Ignore quota / private-mode errors
  }
}

export function getLessonBriefPreloadStatus(
  classroomId: string,
  module: string,
  assignment: string,
): LessonBriefPreloadStatus | null {
  try {
    const raw = sessionStorage.getItem(preloadStatusKey(classroomId, module, assignment));
    if (raw === 'loading' || raw === 'ready' || raw === 'error') return raw;
    return null;
  } catch {
    return null;
  }
}

export function isLessonBriefCacheReady(
  classroomId: string,
  module: string,
  assignment: string,
): boolean {
  if (getLessonBriefPreloadStatus(classroomId, module, assignment) !== 'ready') return false;
  const students = getLessonBriefStudentNarrativesCache(classroomId, module, assignment);
  return Boolean(students?.narratives);
}
