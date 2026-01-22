/**
 * Classroom Query Hooks
 * React Query hooks for classroom operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getTeacherClassrooms,
  getStudentClassrooms,
  getClassroomById,
  createClassroom,
  updateClassroom,
  getEnrolledStudents,
  findClassroomByInviteCode,
  joinClassroom,
} from '@/services/classroomService';
import type { Classroom } from '@/types';

// Query Keys
export const classroomKeys = {
  all: ['classrooms'] as const,
  lists: () => [...classroomKeys.all, 'list'] as const,
  list: (role: 'teacher' | 'student') => [...classroomKeys.lists(), role] as const,
  details: () => [...classroomKeys.all, 'detail'] as const,
  detail: (id: string) => [...classroomKeys.details(), id] as const,
  students: (classroomId: string) => [...classroomKeys.all, 'students', classroomId] as const,
  byInviteCode: (code: string) => [...classroomKeys.all, 'invite', code] as const,
};

/**
 * Hook to fetch classrooms based on user role
 */
export const useClassrooms = (role: 'teacher' | 'student') => {
  const { user } = useAuth();

  return useQuery({
    queryKey: classroomKeys.list(role),
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      const { data, error } =
        role === 'teacher'
          ? await getTeacherClassrooms(user.id)
          : await getStudentClassrooms(user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to fetch a single classroom by ID
 */
export const useClassroom = (classroomId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: classroomKeys.detail(classroomId || ''),
    queryFn: async () => {
      if (!user || !classroomId) throw new Error('Missing user or classroom ID');
      const isTeacher = user.user_metadata?.role === 'teacher';
      const { data, error } = await getClassroomById(classroomId, isTeacher ? user.id : undefined);
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!classroomId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to fetch enrolled students for a classroom
 */
export const useEnrolledStudents = (classroomId: string | undefined) => {
  return useQuery({
    queryKey: classroomKeys.students(classroomId || ''),
    queryFn: async () => {
      if (!classroomId) throw new Error('Missing classroom ID');
      const { data, error } = await getEnrolledStudents(classroomId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!classroomId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to find a classroom by invite code
 */
export const useClassroomByInviteCode = (inviteCode: string | undefined) => {
  return useQuery({
    queryKey: classroomKeys.byInviteCode(inviteCode || ''),
    queryFn: async () => {
      if (!inviteCode) throw new Error('Missing invite code');
      const { data, error } = await findClassroomByInviteCode(inviteCode);
      if (error) throw error;
      return data;
    },
    enabled: !!inviteCode && inviteCode.length > 0,
  });
};

/**
 * Hook to create a new classroom
 */
export const useCreateClassroom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (classroom: Omit<Classroom, 'id' | 'created_at' | 'invite_code'>) => {
      const { data, error } = await createClassroom(classroom);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classroomKeys.lists() });
    },
  });
};

/**
 * Hook to update a classroom
 */
export const useUpdateClassroom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      classroomId,
      updates,
    }: {
      classroomId: string;
      updates: Partial<Omit<Classroom, 'id' | 'created_at' | 'invite_code' | 'teacher_id'>>;
    }) => {
      const { data, error } = await updateClassroom(classroomId, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { classroomId }) => {
      queryClient.invalidateQueries({ queryKey: classroomKeys.detail(classroomId) });
      queryClient.invalidateQueries({ queryKey: classroomKeys.lists() });
    },
  });
};

/**
 * Hook to join a classroom
 */
export const useJoinClassroom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      classroomId,
      studentId,
    }: {
      classroomId: string;
      studentId: string;
    }) => {
      const { data, error } = await joinClassroom(classroomId, studentId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classroomKeys.lists() });
    },
  });
};








