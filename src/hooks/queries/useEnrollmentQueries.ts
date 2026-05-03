/**
 * Enrollment Query Hooks
 * React Query hooks for enrollment operations
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/useAuth';
import { enrollInClassroom, unenrollFromClassroom, isEnrolled } from '@/services/enrollmentService';
import { getEnrolledStudents } from '@/services/classroomService';
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
 * Warm enrolled-students list cache (same key as {@link useEnrolledStudents} from this module).
 */
export function prefetchEnrolledStudentsList(
  queryClient: QueryClient,
  classroomId: string | undefined,
  staleTimeMs = 5 * 60 * 1000,
) {
  if (!classroomId) return;
  return queryClient.prefetchQuery({
    queryKey: enrollmentKeys.listByClassroom(classroomId),
    queryFn: async () => {
      const { data, error } = await getEnrolledStudents(classroomId);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: staleTimeMs,
  });
}

/**
 * Hook to fetch enrolled students for a classroom
 */
export const useEnrolledStudents = (
  classroomId: string | undefined,
  options?: { staleTime?: number },
) => {
  return useQuery({
    queryKey: enrollmentKeys.listByClassroom(classroomId || ''),
    queryFn: async () => {
      if (!classroomId) throw new Error('Missing classroom ID');
      const { data, error } = await getEnrolledStudents(classroomId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!classroomId,
    staleTime: options?.staleTime ?? 0,
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








