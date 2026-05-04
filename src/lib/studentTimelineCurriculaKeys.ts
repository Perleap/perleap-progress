import type { QueryClient } from '@tanstack/react-query';

/**
 * Root key for batched student timeline curriculum % (whole-course aggregate per classroom).
 * Keep in lib so mutation hooks can invalidate without importing the batched-hook module.
 */
export const studentTimelineCurriculaKeys = {
  all: ['student-timeline-curricula'] as const,
  batch: (studentId: string, sortedClassroomIdsJoin: string) =>
    [...studentTimelineCurriculaKeys.all, studentId, sortedClassroomIdsJoin] as const,
};

/** Call after syllabus/module-flow/step/submission caches change so dashboard timeline % refetches soon. */
export function invalidateStudentTimelineCurriculaQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: studentTimelineCurriculaKeys.all });
}
