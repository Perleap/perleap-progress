import type { QueryClient } from '@tanstack/react-query';
import type { Assignment } from '@/types';
import type { ModuleFlowStep, SectionResource } from '@/types/syllabus';
import {
  assignmentFlowCompleteKeys,
  moduleFlowKeys,
  studentFlowProgressKeys,
} from '@/hooks/queries/useModuleFlowQueries';
import { assignmentKeys } from '@/hooks/queries/useAssignmentQueries';
import { syllabusKeys } from '@/hooks/queries/useSyllabusQueries';
import type { AssignmentRow } from '@/lib/moduleFlow';
import { deriveStudentTimelineFlowPrefetchIndices } from '@/lib/studentTimelineFlowDerive';
import { getAssignmentFlowProgressMaps, getStudentModuleFlowProgress } from '@/services/moduleFlowService';
import {
  STUDENT_TIMELINE_CACHE_GC_MS,
  STUDENT_TIMELINE_CACHE_STALE_MS,
} from '@/lib/studentTimelineCache';

/**
 * After syllabus + per-class assignments + bulk module-flow are in the React Query cache,
 * prefetch step-completion + assignment submission maps needed by timeline curriculum progress.
 * Mirrors derive logic in {@link useStudentCurriculumFlowContext}.
 */
export async function prefetchStudentTimelineFlowProgressCaches(
  queryClient: QueryClient,
  classroomId: string,
  studentId: string,
): Promise<void> {
  const syllabus = queryClient.getQueryData<{
    status?: string;
    sections?: { id: string }[];
    section_resources?: Record<string, SectionResource[]>;
  }>(syllabusKeys.byClassroom(classroomId));

  if (
    syllabus?.status !== 'published' ||
    !syllabus.sections?.length
  ) {
    return;
  }

  const assigns = queryClient.getQueryData<Assignment[]>(
    assignmentKeys.listByClassroom(classroomId, studentId),
  );

  const sectionIds = syllabus.sections.map((s) => s.id);
  const bulkKey = [...sectionIds].sort().join(',');
  const flowBulk =
    queryClient.getQueryData<Record<string, ModuleFlowStep[]>>([
      ...moduleFlowKeys.all,
      'bulk',
      bulkKey,
    ]) ?? {};

  const resourceMap = syllabus.section_resources ?? {};
  const { allStepIds, assignmentIdsSortedJoin: sortedJoin } =
    deriveStudentTimelineFlowPrefetchIndices({
      sectionIds,
      resourceMap,
      flowBulk,
      assigns: (assigns ?? []) as AssignmentRow[],
    });

  const tasks: Promise<void>[] = [];

  if (allStepIds.length > 0) {
    tasks.push(
      queryClient
        .prefetchQuery({
          queryKey: studentFlowProgressKeys.byStudentSteps(studentId, allStepIds),
          queryFn: async () => {
            const { data, error } = await getStudentModuleFlowProgress(studentId, allStepIds);
            if (error) throw error;
            const map: Record<string, boolean> = {};
            (data ?? []).forEach((row) => {
              if (row.status === 'completed') {
                map[row.module_flow_step_id] = true;
              }
            });
            return map;
          },
          staleTime: STUDENT_TIMELINE_CACHE_STALE_MS,
          gcTime: STUDENT_TIMELINE_CACHE_GC_MS,
        })
        .then(() => {}),
    );
  }

  if (sortedJoin.length > 0) {
    tasks.push(
      queryClient
        .prefetchQuery({
          queryKey: assignmentFlowCompleteKeys.bulkByStudentAssignments(studentId, sortedJoin),
          queryFn: async () => {
            const { data, error } = await getAssignmentFlowProgressMaps(
              sortedJoin.split(','),
              studentId,
            );
            if (error) throw error;
            return data;
          },
          staleTime: STUDENT_TIMELINE_CACHE_STALE_MS,
          gcTime: STUDENT_TIMELINE_CACHE_GC_MS,
        })
        .then(() => {}),
    );
  }

  await Promise.all(tasks);
}
