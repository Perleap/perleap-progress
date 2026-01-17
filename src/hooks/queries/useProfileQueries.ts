/**
 * Profile Query Hooks
 * React Query hooks for profile operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getTeacherProfile,
  getStudentProfile,
  updateTeacherProfile,
  updateStudentProfile,
} from '@/services/profileService';
import type { TeacherProfile, StudentProfile } from '@/types';

// Query Keys
export const profileKeys = {
  all: ['profiles'] as const,
  teacher: (userId: string) => [...profileKeys.all, 'teacher', userId] as const,
  student: (userId: string) => [...profileKeys.all, 'student', userId] as const,
};

/**
 * Hook to fetch the current user's teacher profile
 */
export const useTeacherProfile = (userId?: string) => {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: profileKeys.teacher(targetUserId || ''),
    queryFn: async () => {
      if (!targetUserId) throw new Error('Missing user ID');
      const { data, error } = await getTeacherProfile(targetUserId);
      if (error) throw error;
      return data;
    },
    enabled: !!targetUserId && (!!userId || !userId && !!user?.id),
  });
};

/**
 * Hook to fetch the current user's student profile
 */
export const useStudentProfile = (userId?: string) => {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: profileKeys.student(targetUserId || ''),
    queryFn: async () => {
      if (!targetUserId) throw new Error('Missing user ID');
      const { data, error } = await getStudentProfile(targetUserId);
      if (error) throw error;
      return data;
    },
    enabled: !!targetUserId,
  });
};

/**
 * Hook to update the current user's teacher profile
 */
export const useUpdateTeacherProfile = () => {
  const queryClient = useQueryClient();
  const { user, refreshProfile } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<TeacherProfile, 'user_id' | 'created_at'>>) => {
      if (!user) throw new Error('User not authenticated');
      const { data, error } = await updateTeacherProfile(user.id, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: profileKeys.teacher(user.id) });
        refreshProfile(true);
      }
    },
  });
};

/**
 * Hook to update the current user's student profile
 */
export const useUpdateStudentProfile = () => {
  const queryClient = useQueryClient();
  const { user, refreshProfile } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<StudentProfile, 'user_id' | 'created_at'>>) => {
      if (!user) throw new Error('User not authenticated');
      const { data, error } = await updateStudentProfile(user.id, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: profileKeys.student(user.id) });
        refreshProfile(true);
      }
    },
  });
};








