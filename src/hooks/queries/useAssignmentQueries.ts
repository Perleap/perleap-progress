/**
 * Assignment Query Hooks
 * React Query hooks for assignment operations
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { CreateAssignmentInput, UpdateAssignmentInput } from '@/types';
import { USER_ROLES } from '@/config/constants';
import { useAuth } from '@/contexts/useAuth';
import { moduleFlowKeys } from '@/hooks/queries/useModuleFlowQueries';
import { syllabusKeys } from '@/hooks/queries/useSyllabusQueries';
import {
  getClassroomAssignments,
  getAssignmentById,
  getStudentAssignments,
  getStudentAssignmentDetails,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} from '@/services/assignmentService';

/** Default matches App QueryClient staleness (mutations invalidate classroom assignment lists). */
export const CLASSROOM_ASSIGNMENTS_STALE_MS = 2 * 60 * 1000;

// Query Keys
export const assignmentKeys = {
  all: ['assignments'] as const,
  lists: () => [...assignmentKeys.all, 'list'] as const,
  /** Prefix for all classroom assignment list variants (roster + per-student). Invalidate with `exact: false`. */
  classroomAssignmentLists: (classroomId: string) =>
    [...assignmentKeys.lists(), 'classroom', classroomId] as const,
  /**
   * Classroom assignments. `submissionsForUserId` only for students (embeds submissions); teachers/admin use `null` (roster only).
   */
  listByClassroom: (classroomId: string, submissionsForUserId?: string | null) =>
    [
      ...assignmentKeys.classroomAssignmentLists(classroomId),
      submissionsForUserId ?? 'roster',
    ] as const,
  listByStudent: (studentId: string) => [...assignmentKeys.lists(), 'student', studentId] as const,
  details: () => [...assignmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...assignmentKeys.details(), id] as const,
};

/**
 * Warm classroom assignments cache (e.g. admin course picker hover).
 * Pass `submissionsForStudentId` when warming the student-embedded list (same key as student's useClassroomAssignments).
 */
export function prefetchClassroomAssignments(
  queryClient: QueryClient,
  classroomId: string | undefined,
  staleTimeMs = 5 * 60 * 1000,
  submissionsForStudentId?: string | null,
) {
  if (!classroomId) return;
  const submissionsKey = submissionsForStudentId ?? null;
  return queryClient.prefetchQuery({
    queryKey: assignmentKeys.listByClassroom(classroomId, submissionsKey),
    queryFn: async () => {
      const { data, error } = await getClassroomAssignments(
        classroomId,
        submissionsForStudentId ?? undefined,
      );
      if (error) throw error;
      return data || [];
    },
    staleTime: staleTimeMs,
  });
}

/**
 * Hook to fetch assignments for a classroom
 */
export const useClassroomAssignments = (
  classroomId: string | undefined,
  options?: { staleTime?: number }
) => {
  const { user } = useAuth();
  const submissionsForUserId =
    user?.user_metadata?.role === USER_ROLES.STUDENT && user.id ? user.id : null;

  return useQuery({
    queryKey: assignmentKeys.listByClassroom(classroomId || '', submissionsForUserId),
    queryFn: async () => {
      if (!classroomId) throw new Error('Missing classroom ID');
      const { data, error } = await getClassroomAssignments(
        classroomId,
        submissionsForUserId ?? undefined
      );
      if (error) throw error;
      return data || [];
    },
    enabled: !!classroomId,
    staleTime: options?.staleTime ?? CLASSROOM_ASSIGNMENTS_STALE_MS,
  });
};

/**
 * Hook to fetch a single assignment by ID
 */
export const useAssignment = (assignmentId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: assignmentKeys.detail(assignmentId || ''),
    queryFn: async () => {
      if (!user || !assignmentId) throw new Error('Missing assignment ID');
      const { data, error } = await getAssignmentById(assignmentId, user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!assignmentId,
  });
};

/**
 * Hook to fetch assignments for a student (across all enrolled classrooms)
 */
export const useStudentAssignments = (options?: { enabled?: boolean }) => {
  const { user } = useAuth();
  const sectionEnabled = options?.enabled !== false;

  return useQuery({
    queryKey: assignmentKeys.listByStudent(user?.id || ''),
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      const { data, error } = await getStudentAssignments(user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && sectionEnabled,
  });
};

/**
 * Hook to fetch full assignment details for student view
 */
export const useStudentAssignmentDetails = (
  assignmentId: string | undefined,
  opts?: { isTeacherTry?: boolean }
) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [
      ...assignmentKeys.detail(assignmentId || ''),
      'student',
      user?.id,
      !!opts?.isTeacherTry,
    ],
    queryFn: async () => {
      if (!assignmentId || !user) throw new Error('Missing assignment ID or user');
      const { data, error } = await getStudentAssignmentDetails(assignmentId, user.id, opts);
      if (error) throw error;
      return data;
    },
    enabled: !!assignmentId && !!user,
    staleTime: 2 * 60 * 1000,
  });
};

/**
 * Hook to create a new assignment
 */
export const useCreateAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignment: CreateAssignmentInput) => {
      const { data, error } = await createAssignment(assignment);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.classroom_id) {
        queryClient.invalidateQueries({
          queryKey: assignmentKeys.classroomAssignmentLists(data.classroom_id),
          exact: false,
        });
        queryClient.invalidateQueries({
          queryKey: syllabusKeys.byClassroom(data.classroom_id),
        });
        queryClient.invalidateQueries({ queryKey: moduleFlowKeys.all });
      }
      queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
    },
  });
};

/**
 * Hook to update an assignment
 */
export const useUpdateAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      updates,
    }: {
      assignmentId: string;
      updates: Omit<UpdateAssignmentInput, 'id'>;
    }) => {
      const { data, error } = await updateAssignment(assignmentId, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: (data, { assignmentId }) => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.detail(assignmentId) });
      if (data?.classroom_id) {
        queryClient.invalidateQueries({
          queryKey: assignmentKeys.classroomAssignmentLists(data.classroom_id),
          exact: false,
        });
        queryClient.invalidateQueries({
          queryKey: syllabusKeys.byClassroom(data.classroom_id),
        });
        queryClient.invalidateQueries({ queryKey: moduleFlowKeys.all });
      }
    },
  });
};

/**
 * Hook to delete an assignment
 */
export const useDeleteAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      classroomId,
    }: {
      assignmentId: string;
      classroomId: string;
    }) => {
      const { success, error } = await deleteAssignment(assignmentId);
      if (error) throw error;
      return { success, classroomId };
    },
    onSuccess: (_, { classroomId }) => {
      queryClient.invalidateQueries({
        queryKey: assignmentKeys.classroomAssignmentLists(classroomId),
        exact: false,
      });
      queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: moduleFlowKeys.all });
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};
