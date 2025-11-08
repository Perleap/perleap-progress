/**
 * Profile Service
 * Handles user profile operations for teachers and students
 */

import { supabase, handleSupabaseError } from '@/api/client';
import type { TeacherProfile, StudentProfile, ApiError } from '@/types';

/**
 * Fetch teacher profile by user ID
 */
export const getTeacherProfile = async (
  userId: string,
): Promise<{ data: TeacherProfile | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('teacher_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Fetch student profile by user ID
 */
export const getStudentProfile = async (
  userId: string,
): Promise<{ data: StudentProfile | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Update teacher profile
 */
export const updateTeacherProfile = async (
  userId: string,
  updates: Partial<Omit<TeacherProfile, 'user_id' | 'created_at'>>,
): Promise<{ data: TeacherProfile | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('teacher_profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Update student profile
 */
export const updateStudentProfile = async (
  userId: string,
  updates: Partial<Omit<StudentProfile, 'user_id' | 'created_at'>>,
): Promise<{ data: StudentProfile | null; error: ApiError | null }> => {
  try {
    const { data, error} = await supabase
      .from('student_profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Get user initials from profile
 */
export const getInitials = (firstName?: string, lastName?: string): string => {
  const first = firstName?.[0] || '';
  const last = lastName?.[0] || '';
  return `${first}${last}`.toUpperCase() || 'U';
};

