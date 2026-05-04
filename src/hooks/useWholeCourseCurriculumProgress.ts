import { useMemo } from 'react';
import { useClassroomAssignments, useSyllabus } from '@/hooks/queries';
import {
  useModuleFlowStepsBulk,
  useStudentCurriculumFlowContext,
} from '@/hooks/queries/useModuleFlowQueries';
import { computeWholeCourseCurriculumAggregate } from '@/lib/wholeCourseCurriculumCompute';
import type { AssignmentRow } from '@/lib/moduleFlow';
import { STUDENT_TIMELINE_CACHE_STALE_MS } from '@/lib/studentTimelineCache';

/** Whole-published-course step progress (activities + assignments in module flow across all sections). */
export function useWholeCourseCurriculumProgress(
  classroomId: string | undefined,
  userId: string | undefined,
  enabled: boolean,
) {
  const { data: syllabus, isLoading: syllabusLoading } = useSyllabus(enabled ? classroomId : undefined, {
    staleTime: STUDENT_TIMELINE_CACHE_STALE_MS,
  });
  const { data: rawAssignments = [], isLoading: assignmentsLoading } = useClassroomAssignments(
    enabled ? classroomId : undefined,
    { staleTime: STUDENT_TIMELINE_CACHE_STALE_MS },
  );

  const hasPublished = Boolean(syllabus && syllabus.status === 'published');
  const syllabusSectionIds = useMemo(
    () => (syllabus?.sections ? [...syllabus.sections].map((s) => s.id) : []),
    [syllabus?.sections],
  );

  const { data: moduleFlowBulk = {}, isPending: bulkPending } = useModuleFlowStepsBulk(
    enabled && hasPublished ? syllabusSectionIds : [],
  );

  const syllabusComputationEnabled =
    !!enabled &&
    !!userId &&
    hasPublished &&
    syllabusSectionIds.length > 0 &&
    syllabus !== undefined;

  const { flowCtx, isLoadingProgress: curriculumFlowProgressLoading } = useStudentCurriculumFlowContext({
    userId,
    sectionIds: syllabusSectionIds,
    flowBulk: moduleFlowBulk,
    resourceMap: syllabus?.section_resources ?? {},
    assignments: rawAssignments as AssignmentRow[],
    enabled: syllabusComputationEnabled,
  });

  const aggregate = useMemo(
    () =>
      computeWholeCourseCurriculumAggregate({
        syllabus,
        syllabusComputationEnabled,
        rawAssignments: rawAssignments as AssignmentRow[],
        moduleFlowBulk,
        flowCtx,
      }),
    [syllabusComputationEnabled, syllabus, moduleFlowBulk, rawAssignments, flowCtx],
  );

  const isLoading =
    !!enabled &&
    (syllabusLoading || assignmentsLoading || bulkPending || curriculumFlowProgressLoading);

  return {
    done: aggregate.done,
    total: aggregate.total,
    percent: aggregate.percent,
    meaningful: aggregate.meaningful,
    isLoading,
  };
}
