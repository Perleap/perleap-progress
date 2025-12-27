/**
 * Assignment Query Hooks
 * React Query hooks for assignment operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getClassroomAssignments,
  getAssignmentById,
  getStudentAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} from '@/services/assignmentService';
import type { CreateAssignmentInput, UpdateAssignmentInput } from '@/types';

// Query Keys
export const assignmentKeys = {
  all: ['assignments'] as const,
  lists: () => [...assignmentKeys.all, 'list'] as const,
  listByClassroom: (classroomId: string) => [...assignmentKeys.lists(), 'classroom', classroomId] as const,
  listByStudent: (studentId: string) => [...assignmentKeys.lists(), 'student', studentId] as const,
  details: () => [...assignmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...assignmentKeys.details(), id] as const,
};

/**
 * Hook to fetch assignments for a classroom
 */
export const useClassroomAssignments = (classroomId: string | undefined) => {
  return useQuery({
    queryKey: assignmentKeys.listByClassroom(classroomId || ''),
    queryFn: async () => {
      if (!classroomId) throw new Error('Missing classroom ID');
      const { data, error } = await getClassroomAssignments(classroomId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!classroomId,
  });
};

/**
 * Hook to fetch a single assignment by ID
 */
export const useAssignment = (assignmentId: string | undefined) => {
  return useQuery({
    queryKey: assignmentKeys.detail(assignmentId || ''),
    queryFn: async () => {
      if (!assignmentId) throw new Error('Missing assignment ID');
      const { data, error } = await getAssignmentById(assignmentId);
      if (error) throw error;
      return data;
    },
    enabled: !!assignmentId,
  });
};

/**
 * Hook to fetch assignments for a student (across all enrolled classrooms)
 */
export const useStudentAssignments = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: assignmentKeys.listByStudent(user?.id || ''),
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      const { data, error } = await getStudentAssignments(user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
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
          queryKey: assignmentKeys.listByClassroom(data.classroom_id),
        });
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
          queryKey: assignmentKeys.listByClassroom(data.classroom_id),
        });
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
        queryKey: assignmentKeys.listByClassroom(classroomId),
      });
      queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
    },
  });
};








