/**
 * React Query hooks for module flow steps and student progress
 */

import { useMemo } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  computeDefaultModuleFlow,
  getOrderedActivityCenterFlowSteps,
  type AssignmentRow,
} from '@/lib/moduleFlow';
import type { StudentFlowProgressContext } from '@/lib/moduleFlowStudent';
import {
  getModuleFlowSteps,
  getModuleFlowStepsBySections,
  replaceModuleFlowSteps,
  getStudentModuleFlowProgress,
  upsertStudentModuleFlowProgress,
  hasCompletedAssignmentSubmission,
  getAssignmentFlowProgressMaps,
  type FlowStepInput,
} from '@/services/moduleFlowService';
import type { ModuleFlowStep, SectionResource } from '@/types/syllabus';
import { getAssignmentSubmittedOrCompletedMap } from '@/services/syllabusService';
import { STUDENT_TIMELINE_CACHE_GC_MS, STUDENT_TIMELINE_CACHE_STALE_MS } from '@/lib/studentTimelineCache';
import { invalidateStudentTimelineCurriculaQueries } from '@/lib/studentTimelineCurriculaKeys';
import { syllabusKeys } from './useSyllabusQueries';

/** Client-only rows so the module-flow query matches the save payload before refetch (instant UI). */
function optimisticModuleFlowStepsFromInputs(
  sectionId: string,
  steps: FlowStepInput[],
): ModuleFlowStep[] {
  const now = new Date().toISOString();
  return steps.map((s) => ({
    id: `optimistic:${sectionId}:${s.order_index}`,
    section_id: sectionId,
    order_index: s.order_index,
    step_kind: s.step_kind,
    activity_list_id: s.step_kind === 'resource' ? s.activity_list_id ?? null : null,
    assignment_id: s.step_kind === 'assignment' ? s.assignment_id ?? null : null,
    created_at: now,
    updated_at: now,
  }));
}

/** Invalidate only queries that include this section (not `module-flow` root, syllabus, or resources). */
export function invalidateModuleFlowQueriesForSection(
  queryClient: QueryClient,
  sectionId: string,
): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey;
      if (!Array.isArray(k) || k[0] !== 'module-flow') return false;
      if (k[1] === 'section' && k[2] === sectionId) return true;
      if (k[1] === 'bulk' && typeof k[2] === 'string') {
        return k[2].split(',').includes(sectionId);
      }
      return false;
    },
  });
}

export const moduleFlowKeys = {
  all: ['module-flow'] as const,
  bySection: (sectionId: string) => [...moduleFlowKeys.all, 'section', sectionId] as const,
};

export const studentFlowProgressKeys = {
  all: ['student-module-flow-progress'] as const,
  byStudentSteps: (studentId: string, stepIds: string[]) =>
    [...studentFlowProgressKeys.all, studentId, stepIds.slice().sort().join(',')] as const,
};

export const assignmentSubmittedFlagsKeys = {
  all: ['assignment-submitted-flags'] as const,
  byStudentAssignments: (studentId: string, assignmentIds: string[]) =>
    [...assignmentSubmittedFlagsKeys.all, studentId, assignmentIds.slice().sort().join(',')] as const,
};

/** Per-assignment completion for curriculum module flow (matches hasCompletedAssignmentSubmission). */
export const assignmentFlowCompleteKeys = {
  all: ['assignment-flow-complete'] as const,
  byAssignmentStudent: (assignmentId: string, studentId: string) =>
    [...assignmentFlowCompleteKeys.all, assignmentId, studentId] as const,
  bulkByStudentAssignments: (studentId: string, sortedIdsJoin: string) =>
    [...assignmentFlowCompleteKeys.all, 'bulk', studentId, sortedIdsJoin] as const,
};

/** Bulk completed + any-row maps for curriculum / section flow (one query, chunked in service). */
export function useAssignmentFlowProgressMaps(
  assignmentIds: string[],
  studentId: string | undefined,
  enabled: boolean,
) {
  const sortedIdsJoin = useMemo(
    () => [...new Set(assignmentIds.filter(Boolean))].sort().join(','),
    [assignmentIds],
  );

  return useQuery({
    queryKey: assignmentFlowCompleteKeys.bulkByStudentAssignments(studentId || '', sortedIdsJoin),
    queryFn: async () => {
      if (!studentId || sortedIdsJoin === '') {
        return { completedMap: {} as Record<string, boolean>, hasAnyRowMap: {} as Record<string, boolean> };
      }
      const { data, error } = await getAssignmentFlowProgressMaps(sortedIdsJoin.split(','), studentId);
      if (error) throw error;
      return data;
    },
    enabled: enabled && !!studentId && sortedIdsJoin.length > 0,
    staleTime: STUDENT_TIMELINE_CACHE_STALE_MS,
    gcTime: STUDENT_TIMELINE_CACHE_GC_MS,
  });
}

/** @deprecated Prefer useAssignmentFlowProgressMaps when you need draft/missed-deadline detection. */
export function useAssignmentCompletedMap(
  assignmentIds: string[],
  studentId: string | undefined,
  enabled: boolean,
) {
  const q = useAssignmentFlowProgressMaps(assignmentIds, studentId, enabled);
  return {
    ...q,
    data: q.data?.completedMap ?? {},
  };
}

export const useAssignmentSubmittedOrCompletedMap = (
  assignmentIds: string[],
  studentId: string | undefined,
) => {
  return useQuery({
    queryKey: assignmentSubmittedFlagsKeys.byStudentAssignments(studentId || '', assignmentIds),
    queryFn: async () => {
      if (!studentId || assignmentIds.length === 0) return {} as Record<string, boolean>;
      const { data, error } = await getAssignmentSubmittedOrCompletedMap(assignmentIds, studentId);
      if (error) throw error;
      return data;
    },
    enabled: !!studentId && assignmentIds.length > 0,
    staleTime: 60 * 1000,
  });
};

const MODULE_FLOW_BULK_STALE_MS = STUDENT_TIMELINE_CACHE_STALE_MS;

/** Warm bulk module-flow steps (matches useModuleFlowStepsBulk query key). */
export function prefetchModuleFlowStepsBulk(
  queryClient: QueryClient,
  sectionIds: string[],
  staleTimeMs = MODULE_FLOW_BULK_STALE_MS,
  gcTimeMs: number = STUDENT_TIMELINE_CACHE_GC_MS,
) {
  if (sectionIds.length === 0) return Promise.resolve();
  const sortedKey = [...sectionIds].sort().join(',');
  return queryClient.prefetchQuery({
    queryKey: [...moduleFlowKeys.all, 'bulk', sortedKey] as const,
    queryFn: async () => {
      const { data, error } = await getModuleFlowStepsBySections(sectionIds);
      if (error) throw error;
      const map: Record<string, ModuleFlowStep[]> = {};
      sectionIds.forEach((id) => {
        map[id] = [];
      });
      (data ?? []).forEach((row) => {
        if (!map[row.section_id]) map[row.section_id] = [];
        map[row.section_id].push(row);
      });
      return map;
    },
    staleTime: staleTimeMs,
    gcTime: gcTimeMs,
  });
}

export const useModuleFlowStepsBulk = (sectionIds: string[]) => {
  const sortedKey = [...sectionIds].sort().join(',');
  return useQuery({
    queryKey: [...moduleFlowKeys.all, 'bulk', sortedKey] as const,
    queryFn: async () => {
      if (sectionIds.length === 0) return {} as Record<string, ModuleFlowStep[]>;
      const { data, error } = await getModuleFlowStepsBySections(sectionIds);
      if (error) throw error;
      const map: Record<string, ModuleFlowStep[]> = {};
      sectionIds.forEach((id) => {
        map[id] = [];
      });
      (data ?? []).forEach((row) => {
        if (!map[row.section_id]) map[row.section_id] = [];
        map[row.section_id].push(row);
      });
      return map;
    },
    enabled: sectionIds.length > 0,
    staleTime: MODULE_FLOW_BULK_STALE_MS,
    gcTime: STUDENT_TIMELINE_CACHE_GC_MS,
  });
};

export const useModuleFlowSteps = (sectionId: string | undefined) => {
  return useQuery({
    queryKey: moduleFlowKeys.bySection(sectionId || ''),
    queryFn: async () => {
      if (!sectionId) throw new Error('Missing section ID');
      const { data, error } = await getModuleFlowSteps(sectionId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!sectionId,
    staleTime: 60 * 1000,
  });
};

export const useReplaceModuleFlow = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sectionId,
      steps,
    }: {
      sectionId: string;
      classroomId: string;
      steps: FlowStepInput[];
    }) => {
      const { error } = await replaceModuleFlowSteps(sectionId, steps);
      if (error) throw error;
    },
    onMutate: async ({ sectionId, steps }) => {
      await queryClient.cancelQueries({ queryKey: moduleFlowKeys.bySection(sectionId) });
      const previous = queryClient.getQueryData<ModuleFlowStep[]>(moduleFlowKeys.bySection(sectionId));
      queryClient.setQueryData(
        moduleFlowKeys.bySection(sectionId),
        optimisticModuleFlowStepsFromInputs(sectionId, steps),
      );
      return { previous };
    },
    onError: (_err, { sectionId }, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(moduleFlowKeys.bySection(sectionId), ctx.previous);
      }
    },
    onSettled: async (_d, _e, { sectionId }) => {
      await invalidateModuleFlowQueriesForSection(queryClient, sectionId);
    },
  });
};

/** Shared Curriculum + outline: flow step completion + assignment submission flags (same query keys as before). */
export function useStudentCurriculumFlowContext(options: {
  userId: string | undefined;
  sectionIds: string[];
  flowBulk: Record<string, ModuleFlowStep[]>;
  resourceMap: Record<string, SectionResource[]>;
  assignments: AssignmentRow[];
  enabled?: boolean;
}): { flowCtx: StudentFlowProgressContext; isLoadingProgress: boolean } {
  const { userId, sectionIds, flowBulk, resourceMap, assignments, enabled = true } = options;

  const allStepIds = useMemo(() => {
    if (!enabled) return [];
    const ids: string[] = [];
    sectionIds.forEach((sid) => {
      const persisted = flowBulk[sid] ?? [];
      const resources = resourceMap[sid] ?? [];
      getOrderedActivityCenterFlowSteps(persisted, resources).forEach((s) => ids.push(s.id));
    });
    return ids;
  }, [enabled, flowBulk, sectionIds, resourceMap]);

  const { data: progressByStep = {}, isLoading: isLoadingStepProgress } = useStudentModuleFlowProgressMap(
    enabled ? userId : undefined,
    allStepIds,
  );

  const assignmentIdsInFlow = useMemo(() => {
    if (!enabled) return [];
    const set = new Set<string>();
    sectionIds.forEach((sid) => {
      const persisted = flowBulk[sid] ?? [];
      const resources = resourceMap[sid] ?? [];
      getOrderedActivityCenterFlowSteps(persisted, resources).forEach((step) => {
        if (step.step_kind === 'assignment' && step.assignment_id) set.add(step.assignment_id);
      });
      computeDefaultModuleFlow(sid, resources, assignments).forEach((c) => {
        if (c.kind === 'assignment') set.add(c.assignment_id);
      });
    });
    return [...set];
  }, [enabled, flowBulk, sectionIds, resourceMap, assignments]);

  const { data: flowMaps, isLoading: isLoadingAssignmentDone } = useAssignmentFlowProgressMaps(
    assignmentIdsInFlow,
    userId,
    enabled,
  );
  const assignmentDoneMap = flowMaps?.completedMap ?? {};
  const assignmentHasSubmissionRowMap = flowMaps?.hasAnyRowMap ?? {};

  const flowCtx = useMemo(
    () => ({ progressByStep, assignmentDoneMap, assignmentHasSubmissionRowMap }),
    [progressByStep, assignmentDoneMap, assignmentHasSubmissionRowMap],
  );

  return { flowCtx, isLoadingProgress: isLoadingStepProgress || isLoadingAssignmentDone };
}

export const useStudentModuleFlowProgressMap = (
  studentId: string | undefined,
  stepIds: string[],
) => {
  return useQuery({
    queryKey: studentFlowProgressKeys.byStudentSteps(studentId || '', stepIds),
    queryFn: async () => {
      if (!studentId || stepIds.length === 0) return {} as Record<string, boolean>;
      const { data, error } = await getStudentModuleFlowProgress(studentId, stepIds);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((row) => {
        if (row.status === 'completed') {
          map[row.module_flow_step_id] = true;
        }
      });
      return map;
    },
    enabled: !!studentId && stepIds.length > 0,
    staleTime: STUDENT_TIMELINE_CACHE_STALE_MS,
    gcTime: STUDENT_TIMELINE_CACHE_GC_MS,
  });
};

export const useMarkFlowStepComplete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      studentId,
      moduleFlowStepId,
      sectionId,
      classroomId,
    }: {
      studentId: string;
      moduleFlowStepId: string;
      sectionId: string;
      classroomId: string;
    }) => {
      const { data, error } = await upsertStudentModuleFlowProgress(
        studentId,
        moduleFlowStepId,
        'completed',
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { sectionId, classroomId }) => {
      queryClient.invalidateQueries({
        queryKey: studentFlowProgressKeys.all,
      });
      queryClient.invalidateQueries({ queryKey: moduleFlowKeys.bySection(sectionId) });
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      invalidateStudentTimelineCurriculaQueries(queryClient);
    },
  });
};

export const useAssignmentFlowCompletion = (
  assignmentId: string | undefined,
  studentId: string | undefined,
) => {
  return useQuery({
    queryKey: assignmentFlowCompleteKeys.byAssignmentStudent(assignmentId || '', studentId || ''),
    queryFn: async () => {
      if (!assignmentId || !studentId) return false;
      const { completed, error } = await hasCompletedAssignmentSubmission(
        assignmentId,
        studentId,
      );
      if (error) throw error;
      return completed;
    },
    enabled: !!assignmentId && !!studentId,
    staleTime: 30 * 1000,
  });
};
