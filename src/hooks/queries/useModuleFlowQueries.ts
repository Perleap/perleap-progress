/**
 * React Query hooks for module flow steps and student progress
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getModuleFlowSteps,
  getModuleFlowStepsBySections,
  replaceModuleFlowSteps,
  getStudentModuleFlowProgress,
  upsertStudentModuleFlowProgress,
  hasCompletedAssignmentSubmission,
  type FlowStepInput,
} from '@/services/moduleFlowService';
import type { ModuleFlowStep } from '@/types/syllabus';
import { syllabusKeys, resourceKeys } from './useSyllabusQueries';

export const moduleFlowKeys = {
  all: ['module-flow'] as const,
  bySection: (sectionId: string) => [...moduleFlowKeys.all, 'section', sectionId] as const,
};

export const studentFlowProgressKeys = {
  all: ['student-module-flow-progress'] as const,
  byStudentSteps: (studentId: string, stepIds: string[]) =>
    [...studentFlowProgressKeys.all, studentId, stepIds.slice().sort().join(',')] as const,
};

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
    staleTime: 60 * 1000,
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
      classroomId,
      steps,
    }: {
      sectionId: string;
      classroomId: string;
      steps: FlowStepInput[];
    }) => {
      const { error } = await replaceModuleFlowSteps(sectionId, steps);
      if (error) throw error;
    },
    onSuccess: (_, { sectionId, classroomId }) => {
      queryClient.invalidateQueries({ queryKey: moduleFlowKeys.bySection(sectionId) });
      queryClient.invalidateQueries({ queryKey: moduleFlowKeys.all });
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      queryClient.invalidateQueries({ queryKey: resourceKeys.bySection(sectionId) });
    },
  });
};

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
    staleTime: 30 * 1000,
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
    onSuccess: (_, { sectionId, classroomId, studentId }) => {
      queryClient.invalidateQueries({
        queryKey: studentFlowProgressKeys.all,
      });
      queryClient.invalidateQueries({ queryKey: moduleFlowKeys.bySection(sectionId) });
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

export const useAssignmentFlowCompletion = (
  assignmentId: string | undefined,
  studentId: string | undefined,
) => {
  return useQuery({
    queryKey: ['assignment-flow-complete', assignmentId, studentId],
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
