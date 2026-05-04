/**
 * React Query cache hints for student dashboard timeline curriculum prefetch.
 * Longer stale window reduces refetch thrash when many classroom cards mount together.
 * Mutations still invalidate affected queries (syllabus, module flow, assignments).
 */
export const STUDENT_TIMELINE_CACHE_STALE_MS = 10 * 60 * 1000;
export const STUDENT_TIMELINE_CACHE_GC_MS = 60 * 60 * 1000;
