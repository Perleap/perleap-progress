/**
 * Single-section module flow data for student sequential access (route guards + shared with list logic).
 */

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  useSyllabus,
  useClassroomAssignments,
} from '@/hooks/queries';
import {
  useModuleFlowSteps,
  useStudentModuleFlowProgressMap,
} from '@/hooks/queries/useModuleFlowQueries';
import { hasCompletedAssignmentSubmission } from '@/services/moduleFlowService';
import {
  computeDefaultModuleFlow,
  getOrderedActivityCenterFlowSteps,
  type ComputedFlowItem,
} from '@/lib/moduleFlow';
import type { StudentFlowProgressContext } from '@/lib/moduleFlowStudent';
import type { ModuleFlowStep } from '@/types/syllabus';

export function useStudentSectionModuleFlow(
  classroomId: string | undefined,
  sectionId: string | undefined,
  studentId: string | undefined,
) {
  const { data: syllabus, isLoading: syllabusLoading } = useSyllabus(classroomId);
  const { data: assignments = [] } = useClassroomAssignments(classroomId);
  const { data: flowSteps = [], isLoading: flowLoading } = useModuleFlowSteps(sectionId);

  const sectionResources = useMemo(
    () => (sectionId ? syllabus?.section_resources?.[sectionId] ?? [] : []),
    [syllabus?.section_resources, sectionId],
  );

  const orderedPersisted = useMemo(
    () => getOrderedActivityCenterFlowSteps(flowSteps, sectionResources),
    [flowSteps, sectionResources],
  );

  const computed = useMemo(
    () =>
      sectionId
        ? computeDefaultModuleFlow(
            sectionId,
            sectionResources,
            assignments as { id: string; syllabus_section_id?: string | null; due_at?: string | null }[],
          )
        : [],
    [sectionId, sectionResources, assignments],
  );

  const usePersistedFlow = orderedPersisted.length > 0;

  const flowStepIds = useMemo(() => orderedPersisted.map((s) => s.id), [orderedPersisted]);

  const { data: progressByStep = {} } = useStudentModuleFlowProgressMap(studentId, flowStepIds);

  const assignmentIdsInSection = useMemo(() => {
    const set = new Set<string>();
    orderedPersisted.forEach((s) => {
      if (s.step_kind === 'assignment' && s.assignment_id) set.add(s.assignment_id);
    });
    computed.forEach((c) => {
      if (c.kind === 'assignment') set.add(c.assignment_id);
    });
    return [...set];
  }, [orderedPersisted, computed]);

  const assignmentDoneQueries = useQueries({
    queries: assignmentIdsInSection.map((aid) => ({
      queryKey: ['assignment-flow-complete', aid, studentId],
      queryFn: async () => {
        const { completed, error } = await hasCompletedAssignmentSubmission(aid, studentId!);
        if (error) throw error;
        return { aid, completed };
      },
      enabled: !!studentId && !!aid && !!sectionId,
    })),
  });

  const assignmentDoneMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    assignmentDoneQueries.forEach((q, i) => {
      const aid = assignmentIdsInSection[i];
      if (aid && q.data) m[aid] = q.data.completed;
    });
    return m;
  }, [assignmentDoneQueries, assignmentIdsInSection]);

  const ctx: StudentFlowProgressContext = useMemo(
    () => ({ progressByStep, assignmentDoneMap }),
    [progressByStep, assignmentDoneMap],
  );

  const queriesLoading = assignmentDoneQueries.some((q) => q.isLoading);
  const loading =
    !!classroomId &&
    !!sectionId &&
    (syllabusLoading || flowLoading || queriesLoading);

  return {
    loading,
    syllabus,
    sectionResources,
    orderedPersisted,
    computed,
    usePersistedFlow,
    ctx,
    assignments,
  };
}

export type StudentSectionModuleFlowResult = {
  loading: boolean;
  orderedPersisted: ModuleFlowStep[];
  computed: ComputedFlowItem[];
  usePersistedFlow: boolean;
  ctx: StudentFlowProgressContext;
};
