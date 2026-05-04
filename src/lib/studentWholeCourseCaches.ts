import type { QueryClient } from '@tanstack/react-query';
import {
  assignmentFlowCompleteKeys,
  moduleFlowKeys,
  prefetchModuleFlowStepsBulk,
  studentFlowProgressKeys,
} from '@/hooks/queries/useModuleFlowQueries';
import { assignmentKeys } from '@/hooks/queries/useAssignmentQueries';
import { syllabusKeys } from '@/hooks/queries/useSyllabusQueries';
import type { AssignmentRow } from '@/lib/moduleFlow';
import type { StudentFlowProgressContext } from '@/lib/moduleFlowStudent';
import { deriveStudentTimelineFlowPrefetchIndices } from '@/lib/studentTimelineFlowDerive';
import { prefetchStudentTimelineFlowProgressCaches } from '@/lib/studentTimelinePrefetch';
import {
  STUDENT_TIMELINE_CACHE_GC_MS,
  STUDENT_TIMELINE_CACHE_STALE_MS,
} from '@/lib/studentTimelineCache';
import { computeWholeCourseCurriculumAggregate } from '@/lib/wholeCourseCurriculumCompute';
import type { Assignment } from '@/types';
import type { ModuleFlowStep, SyllabusWithSections } from '@/types/syllabus';
import { getClassroomAssignments } from '@/services/assignmentService';
import { getSyllabusByClassroom } from '@/services/syllabusService';

export type StudentWholeCourseClassroomResult = {
  classroomId: string;
  done: number;
  total: number;
  percent: number;
  meaningful: boolean;
};

/**
 * Fills the same React Query entries as {@link useWholeCourseCurriculumProgress}, then computes
 * curriculum % from cache (no hook). Used by the student timeline batched loader.
 */
export async function ensureStudentWholeCourseCachesForClassroom(
  queryClient: QueryClient,
  classroomId: string,
  studentId: string,
): Promise<StudentWholeCourseClassroomResult> {
  await queryClient.fetchQuery({
    queryKey: syllabusKeys.byClassroom(classroomId),
    queryFn: async () => {
      const { data, error } = await getSyllabusByClassroom(classroomId);
      if (error) throw error;
      return data;
    },
    staleTime: STUDENT_TIMELINE_CACHE_STALE_MS,
    gcTime: STUDENT_TIMELINE_CACHE_GC_MS,
  });

  await queryClient.fetchQuery({
    queryKey: assignmentKeys.listByClassroom(classroomId, studentId),
    queryFn: async () => {
      const { data, error } = await getClassroomAssignments(classroomId, studentId);
      if (error) throw error;
      return data || [];
    },
    staleTime: STUDENT_TIMELINE_CACHE_STALE_MS,
    gcTime: STUDENT_TIMELINE_CACHE_GC_MS,
  });

  const syllabus = queryClient.getQueryData<SyllabusWithSections | null>(
    syllabusKeys.byClassroom(classroomId),
  );

  const rawAssignments = (queryClient.getQueryData<Assignment[]>(
    assignmentKeys.listByClassroom(classroomId, studentId),
  ) ?? []) as unknown as AssignmentRow[];

  const hasPublished = Boolean(syllabus?.status === 'published');
  const syllabusSectionIds = syllabus?.sections?.map((s) => s.id) ?? [];

  let moduleFlowBulk: Record<string, ModuleFlowStep[]> = {};

  if (hasPublished && syllabusSectionIds.length > 0) {
    await prefetchModuleFlowStepsBulk(
      queryClient,
      syllabusSectionIds,
      STUDENT_TIMELINE_CACHE_STALE_MS,
      STUDENT_TIMELINE_CACHE_GC_MS,
    );
    await prefetchStudentTimelineFlowProgressCaches(queryClient, classroomId, studentId);

    const bulkKey = [...syllabusSectionIds].sort().join(',');
    moduleFlowBulk =
      queryClient.getQueryData<Record<string, ModuleFlowStep[]>>([
        ...moduleFlowKeys.all,
        'bulk',
        bulkKey,
      ]) ?? {};
  }

  const syllabusComputationEnabled =
    !!studentId && hasPublished && syllabusSectionIds.length > 0 && syllabus !== undefined;

  let flowCtx: StudentFlowProgressContext = {
    progressByStep: {},
    assignmentDoneMap: {},
    assignmentHasSubmissionRowMap: {},
  };

  if (syllabusComputationEnabled && syllabus) {
    const resourceMap = syllabus.section_resources ?? {};
    const { allStepIds, assignmentIdsSortedJoin } = deriveStudentTimelineFlowPrefetchIndices({
      sectionIds: syllabusSectionIds,
      resourceMap,
      flowBulk: moduleFlowBulk,
      assigns: rawAssignments,
    });

    const progressByStep =
      (allStepIds.length > 0
        ? queryClient.getQueryData<Record<string, boolean>>(
            studentFlowProgressKeys.byStudentSteps(studentId, allStepIds),
          )
        : undefined) ?? {};

    const flowMaps =
      assignmentIdsSortedJoin.length > 0
        ? queryClient.getQueryData<{
            completedMap: Record<string, boolean>;
            hasAnyRowMap: Record<string, boolean>;
          }>(
            assignmentFlowCompleteKeys.bulkByStudentAssignments(
              studentId,
              assignmentIdsSortedJoin,
            ),
          )
        : undefined;

    flowCtx = {
      progressByStep,
      assignmentDoneMap: flowMaps?.completedMap ?? {},
      assignmentHasSubmissionRowMap: flowMaps?.hasAnyRowMap ?? {},
    };
  }

  const aggregate = computeWholeCourseCurriculumAggregate({
    syllabus,
    syllabusComputationEnabled,
    rawAssignments: rawAssignments as AssignmentRow[],
    moduleFlowBulk,
    flowCtx,
  });

  return {
    classroomId,
    done: aggregate.done,
    total: aggregate.total,
    percent: aggregate.percent,
    meaningful: aggregate.meaningful,
  };
}
