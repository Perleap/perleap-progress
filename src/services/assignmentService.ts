/**
 * Assignment Service
 * Handles all assignment-related operations
 */

import { supabase, handleSupabaseError } from '@/api/client';
import type { Database, Json } from '@/integrations/supabase/types';
import { getAssignmentLanguage } from '@/utils/languageDetection';
import { removeAssignmentFromModuleFlows } from './moduleFlowService';
import { getStudentSubmissionContext } from './submissionService';
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
      .select('*, student_profiles(full_name)')
      .eq('classroom_id', classroomId)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    if (!assignments || assignments.length === 0) {
      return { data: [], error: null };
    }

    // Transform to ensure student_profiles is an object, even if returned as array
    const transformedAssignments = assignments.map(a => {
      const profile = (a as any).student_profiles;
      return {
        ...a,
        student_profiles: Array.isArray(profile) ? profile[0] : profile
      };
    });

    let finalAssignments = transformedAssignments;

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

    return { data: finalAssignments as unknown as Assignment[], error: null };
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
      .select('*, student_profiles(full_name), classrooms(name, teacher_id)')
      .eq('id', assignmentId)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    if (!assignment) {
      return { data: null, error: null };
    }

    // Transform to ensure student_profiles is an object
    const profile = (assignment as any).student_profiles;
    const transformedAssignment = {
      ...assignment,
      student_profiles: Array.isArray(profile) ? profile[0] : profile
    };

    // Fetch submission for this assignment for this student
    const { data: submissions, error: subError } = await supabase
      .from('submissions')
      .select('*, assignment_feedback(id)')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId);

    const assignmentWithSubmission = {
      ...transformedAssignment,
      submissions: submissions || [],
    } as unknown as AssignmentWithClassroom;

    return { data: assignmentWithSubmission, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Get full assignment details for student view, including teacher info and submission
 */
export const getStudentAssignmentDetails = async (
  assignmentId: string,
  studentId: string
): Promise<{ data: any | null; error: ApiError | null }> => {
  try {
    // 1. Fetch assignment with classroom and teacher info in one join
    const { data: assignment, error: assignError } = await supabase
      .from('assignments')
      .select(`
        *, 
        classrooms(
          name, 
          teacher_id, 
          teacher_profiles(full_name, avatar_url)
        )
      `)
      .eq('id', assignmentId)
      .eq('active', true)
      .maybeSingle();

    if (assignError) throw assignError;
    if (!assignment) return { data: null, error: null };

    // 2. Active submission + attempt policy
    const { data: ctx, error: subError } = await getStudentSubmissionContext(assignmentId, studentId);
    if (subError) throw subError;

    const submission = ctx.submission;

    // 3. Fetch feedback if submission exists
    let feedback = null;
    if (submission) {
      const { data: feedbackData } = await supabase
        .from('assignment_feedback')
        .select('*')
        .eq('submission_id', submission.id)
        .maybeSingle();
      feedback = feedbackData;
    }

    return {
      data: {
        ...assignment,
        submission,
        feedback,
        submissionContext: {
          allAttempts: ctx.allAttempts,
          canRetry: ctx.canRetry,
        },
      },
      error: null
    };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

type GenerateStudentFacingResponse = {
  studentFacingTask?: string;
  source?: string;
  persisted?: boolean;
  error?: string;
};

/**
 * For students: generate (or return cached) the short cognitive task card via Edge Function, persisting to DB when generated.
 */
export const ensureStudentFacingTask = async (
  assignmentId: string,
  language: 'en' | 'he',
) => {
  return supabase.functions.invoke<GenerateStudentFacingResponse>('generate-student-facing-task', {
    body: { assignmentId, language },
  });
};

/**
 * When `student_facing_task` is still empty, generate and persist the cognitive task card (edge function; no-op if already set).
 * Call after create, or when saving an assignment without a hand-written student summary.
 */
export async function prefillStudentFacingTaskForAssignment(
  assignmentId: string,
  options: { instructions: string; uiLanguage: 'he' | 'en' },
): Promise<void> {
  if (!assignmentId || !options.instructions.trim()) return;
  const lang = getAssignmentLanguage(options.instructions, options.uiLanguage);
  const { error } = await ensureStudentFacingTask(assignmentId, lang);
  if (error) {
    console.warn('prefillStudentFacingTaskForAssignment', error);
  }
}

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
      .eq('student_id', studentId)
      .eq('active', true);

    if (enrollError || !enrollments || enrollments.length === 0) {
      return { data: [], error: enrollError ? handleSupabaseError(enrollError) : null };
    }

    const classroomIds = enrollments.map((e) => e.classroom_id);

    const { data: assignments, error } = await supabase
      .from('assignments')
      .select('*, classrooms(name, teacher_id)')
      .in('classroom_id', classroomIds)
      .eq('status', 'published')
      .eq('active', true)
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
      return { data: assignments as unknown as AssignmentWithClassroom[], error: null };
    }

    // Merge submissions into assignments
    const assignmentsWithSubmissions = assignments.map(a => ({
      ...a,
      submissions: submissions?.filter(s => s.assignment_id === a.id) || []
    })) as unknown as AssignmentWithClassroom[];

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
    const row: Database['public']['Tables']['assignments']['Insert'] = {
      classroom_id: assignment.classroom_id,
      title: assignment.title,
      instructions: assignment.instructions,
      type: assignment.type,
      due_at: assignment.due_at,
      status: assignment.status,
      target_dimensions: assignment.target_dimensions as unknown as Json,
      personalization_flag: assignment.personalization_flag,
      auto_publish_ai_feedback: assignment.auto_publish_ai_feedback,
      attempt_mode: assignment.attempt_mode,
    };
    const { data, error } = await supabase.from('assignments').insert([row]).select().single();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    if (data?.id) {
      const row = data as unknown as Assignment;
      const hasTask = Boolean(String(row.student_facing_task ?? '').trim());
      const inst = String(row.instructions ?? assignment.instructions ?? '');
      if (!hasTask && inst.trim()) {
        void prefillStudentFacingTaskForAssignment(data.id, {
          instructions: inst,
          uiLanguage: 'en',
        });
      }
    }

    return { data: data as unknown as Assignment, error: null };
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
    const { target_dimensions, materials, ...rest } = updates;
    const payload: Database['public']['Tables']['assignments']['Update'] = { ...rest };
    if (target_dimensions !== undefined)
      payload.target_dimensions = target_dimensions as unknown as Json;
    if (materials !== undefined) payload.materials = materials as unknown as Json | null;
    const { data, error } = await supabase
      .from('assignments')
      .update(payload)
      .eq('id', assignmentId)
      .select()
      .single();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    if (data?.id) {
      const row = data as unknown as Assignment;
      const hasTask = Boolean(String(row.student_facing_task ?? '').trim());
      const inst =
        updates.instructions !== undefined
          ? String(updates.instructions ?? '')
          : String(row.instructions ?? '');
      if (!hasTask && inst.trim()) {
        void prefillStudentFacingTaskForAssignment(data.id, {
          instructions: inst,
          uiLanguage: 'en',
        });
      }
    }

    return { data: data as unknown as Assignment, error: null };
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
    const deletedAt = new Date().toISOString();
    const { error } = await supabase
      .from('assignments')
      .update({ active: false, deleted_at: deletedAt })
      .eq('id', assignmentId);

    if (error) {
      return { success: false, error: handleSupabaseError(error) };
    }

    const { error: flowError } = await removeAssignmentFromModuleFlows(assignmentId);
    if (flowError) {
      return { success: false, error: flowError };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: handleSupabaseError(error) };
  }
};
