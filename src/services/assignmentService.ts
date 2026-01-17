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
  classroomId: string,
  studentId?: string
): Promise<{ data: Assignment[] | null; error: ApiError | null }> => {
  try {
    const { data: assignments, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    if (!assignments || assignments.length === 0) {
      return { data: [], error: null };
    }

    let finalAssignments = assignments;

    if (studentId) {
      // If studentId is provided, we only want THIS student's submissions
      const assignmentIds = assignments.map(a => a.id);
      const { data: studentSubmissions, error: subError } = await supabase
        .from('submissions')
        .select('*, assignment_feedback(id)')
        .in('assignment_id', assignmentIds)
        .eq('student_id', studentId);

      if (!subError && studentSubmissions) {
        finalAssignments = assignments.map(a => ({
          ...a,
          submissions: studentSubmissions.filter(s => s.assignment_id === a.id)
        }));
      }
    }

    return { data: finalAssignments as Assignment[], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Get assignment by ID with classroom info
 */
export const getAssignmentById = async (
  assignmentId: string,
  studentId: string
): Promise<{ data: AssignmentWithClassroom | null; error: ApiError | null }> => {
  try {
    const { data: assignment, error } = await supabase
      .from('assignments')
      .select('*, classrooms(name, teacher_id)')
      .eq('id', assignmentId)
      .maybeSingle();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    if (!assignment) {
      return { data: null, error: null };
    }

    // Fetch submission for this assignment for this student
    const { data: submissions, error: subError } = await supabase
      .from('submissions')
      .select('*, assignment_feedback(id)')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId);

    const assignmentWithSubmission = {
      ...assignment,
      submissions: submissions || []
    } as AssignmentWithClassroom;

    return { data: assignmentWithSubmission, error: null };
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

    const { data: assignments, error } = await supabase
      .from('assignments')
      .select('*, classrooms(name, teacher_id)')
      .in('classroom_id', classroomIds)
      .eq('status', 'published')
      .order('due_at', { ascending: true });

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    if (!assignments || assignments.length === 0) {
      return { data: [], error: null };
    }

    // Fetch submissions for these assignments for this student
    const assignmentIds = assignments.map(a => a.id);
    const { data: submissions, error: subError } = await supabase
      .from('submissions')
      .select('*, assignment_feedback(id)')
      .in('assignment_id', assignmentIds)
      .eq('student_id', studentId);

    if (subError) {
      console.error('Error fetching student submissions:', subError);
      // We still return assignments even if submissions fail
      return { data: assignments as AssignmentWithClassroom[], error: null };
    }

    // Merge submissions into assignments
    const assignmentsWithSubmissions = assignments.map(a => ({
      ...a,
      submissions: submissions?.filter(s => s.assignment_id === a.id) || []
    })) as AssignmentWithClassroom[];

    return { data: assignmentsWithSubmissions, error: null };
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
