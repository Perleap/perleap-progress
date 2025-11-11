/**
 * Assignment Service
 * Handles all assignment-related operations
 */

import { supabase, handleSupabaseError } from '@/api/client';
import type {
  Assignment,
  AssignmentWithClassroom,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  ApiError,
} from '@/types';

/**
 * Fetch all assignments for a classroom
 */
export const getClassroomAssignments = async (
  classroomId: string
): Promise<{ data: Assignment[] | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Get assignment by ID with classroom info
 */
export const getAssignmentById = async (
  assignmentId: string
): Promise<{ data: AssignmentWithClassroom | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('*, classrooms(name, teacher_id)')
      .eq('id', assignmentId)
      .maybeSingle();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Get assignments for student's enrolled classrooms
 */
export const getStudentAssignments = async (
  studentId: string
): Promise<{ data: AssignmentWithClassroom[] | null; error: ApiError | null }> => {
  try {
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('classroom_id')
      .eq('student_id', studentId);

    if (enrollError || !enrollments || enrollments.length === 0) {
      return { data: [], error: enrollError ? handleSupabaseError(enrollError) : null };
    }

    const classroomIds = enrollments.map((e) => e.classroom_id);

    const { data, error } = await supabase
      .from('assignments')
      .select('*, classrooms(name)')
      .in('classroom_id', classroomIds)
      .eq('status', 'published')
      .order('due_at', { ascending: true });

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Create a new assignment
 */
export const createAssignment = async (
  assignment: CreateAssignmentInput
): Promise<{ data: Assignment | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .insert([assignment])
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
 * Update an assignment
 */
export const updateAssignment = async (
  assignmentId: string,
  updates: Omit<UpdateAssignmentInput, 'id'>
): Promise<{ data: Assignment | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .update(updates)
      .eq('id', assignmentId)
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
 * Delete an assignment
 */
export const deleteAssignment = async (
  assignmentId: string
): Promise<{ success: boolean; error: ApiError | null }> => {
  try {
    const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);

    if (error) {
      return { success: false, error: handleSupabaseError(error) };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: handleSupabaseError(error) };
  }
};
