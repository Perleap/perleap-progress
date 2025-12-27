/**
 * Enrollment Query Hooks
 * React Query hooks for enrollment operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  enrollInClassroom,
  unenrollFromClassroom,
  getEnrolledStudents,
  isEnrolled,
} from '@/services/enrollmentService';
import { classroomKeys } from './useClassroomQueries';

// Query Keys
export const enrollmentKeys = {
  all: ['enrollments'] as const,
  lists: () => [...enrollmentKeys.all, 'list'] as const,
  listByClassroom: (classroomId: string) => [...enrollmentKeys.lists(), 'classroom', classroomId] as const,
  check: (classroomId: string, studentId: string) =>
    [...enrollmentKeys.all, 'check', classroomId, studentId] as const,
};

/**
 * Hook to fetch enrolled students for a classroom
 */
export const useEnrolledStudents = (classroomId: string | undefined) => {
  return useQuery({
    queryKey: enrollmentKeys.listByClassroom(classroomId || ''),
    queryFn: async () => {
      if (!classroomId) throw new Error('Missing classroom ID');
      return await getEnrolledStudents(classroomId);
    },
    enabled: !!classroomId,
  });
};

/**
 * Hook to check if the current user is enrolled in a classroom
 */
export const useIsEnrolled = (classroomId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: enrollmentKeys.check(classroomId || '', user?.id || ''),
    queryFn: async () => {
      if (!classroomId || !user) return false;
      return await isEnrolled(classroomId, user.id);
    },
    enabled: !!classroomId && !!user,
  });
};

/**
 * Hook to enroll in a classroom using invite code
 */
export const useEnrollInClassroom = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      inviteCode,
      studentName,
    }: {
      inviteCode: string;
      studentName: string;
    }) => {
      if (!user) throw new Error('User not authenticated');
      const result = await enrollInClassroom(inviteCode, user.id, studentName);
      if (!result.success) {
        throw new Error(result.error || 'Failed to enroll');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classroomKeys.lists() });
      queryClient.invalidateQueries({ queryKey: enrollmentKeys.lists() });
    },
  });
};

/**
 * Hook to unenroll from a classroom
 */
export const useUnenrollFromClassroom = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (classroomId: string) => {
      if (!user) throw new Error('User not authenticated');
      const success = await unenrollFromClassroom(classroomId, user.id);
      if (!success) {
        throw new Error('Failed to unenroll');
      }
      return { classroomId };
    },
    onSuccess: ({ classroomId }) => {
      queryClient.invalidateQueries({ queryKey: classroomKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.listByClassroom(classroomId),
      });
    },
  });
};








