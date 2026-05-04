import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ensureStudentWholeCourseCachesForClassroom,
  type StudentWholeCourseClassroomResult,
} from '@/lib/studentWholeCourseCaches';
import {
  STUDENT_TIMELINE_CACHE_STALE_MS,
  STUDENT_TIMELINE_CACHE_GC_MS,
} from '@/lib/studentTimelineCache';
import {
  studentTimelineCurriculaKeys,
  invalidateStudentTimelineCurriculaQueries,
} from '@/lib/studentTimelineCurriculaKeys';

/** Max concurrent classroom pipelines (syllabus + assignments + flow + progress). */
export const STUDENT_TIMELINE_CURRICULA_CONCURRENCY = 8;

export { studentTimelineCurriculaKeys, invalidateStudentTimelineCurriculaQueries };

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const j = next++;
      if (j >= items.length) break;
      results[j] = await fn(items[j]);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

export type StudentTimelineCurriculumProgressMap = Record<
  string,
  Pick<StudentWholeCourseClassroomResult, 'percent' | 'meaningful' | 'done' | 'total'>
>;

/**
 * One React Query per dashboard visit: fills RQ cache with bounded concurrency, returns % per classroom.
 */
export function useStudentTimelineCurriculaProgress(
  studentId: string | undefined,
  classroomIds: string[],
  enabled: boolean,
) {
  const queryClient = useQueryClient();

  const sortedUniqueJoin = useMemo(() => {
    const u = [...new Set(classroomIds.filter(Boolean))];
    u.sort();
    return u.join(',');
  }, [classroomIds]);

  return useQuery({
    queryKey: studentTimelineCurriculaKeys.batch(studentId || '', sortedUniqueJoin),
    enabled: enabled && !!studentId && sortedUniqueJoin.length > 0,
    staleTime: STUDENT_TIMELINE_CACHE_STALE_MS,
    gcTime: STUDENT_TIMELINE_CACHE_GC_MS,
    queryFn: async (): Promise<StudentTimelineCurriculumProgressMap> => {
      if (!studentId || sortedUniqueJoin === '') return {};
      const ids = sortedUniqueJoin.split(',').filter(Boolean);
      const rows = await mapWithConcurrency(
        ids,
        STUDENT_TIMELINE_CURRICULA_CONCURRENCY,
        (classroomId) =>
          ensureStudentWholeCourseCachesForClassroom(queryClient, classroomId, studentId),
      );
      const map: StudentTimelineCurriculumProgressMap = {};
      for (const r of rows) {
        map[r.classroomId] = {
          percent: r.percent,
          meaningful: r.meaningful,
          done: r.done,
          total: r.total,
        };
      }
      return map;
    },
  });
}
