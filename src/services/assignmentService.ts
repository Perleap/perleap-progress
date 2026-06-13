/**
 * Assignment Service
 * Handles all assignment-related operations
 */

import { supabase, handleSupabaseError } from '@/api/client';
import { activityListWriteWithUnknownColumnFallback } from '@/lib/activityListSchemaFallback';
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
  studentId: string,
  opts?: { isTeacherTry?: boolean },
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

    // 2. Active submission + attempt policy (reuse assignment row from step 1)
    const { data: ctx, error: subError } = await getStudentSubmissionContext(
      assignmentId,
      studentId,
      opts?.isTeacherTry ? { isTeacherTry: true } : undefined,
      {
        id: assignment.id,
        attempt_mode: assignment.attempt_mode,
        due_at: assignment.due_at,
        status: assignment.status,
      },
    );
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
  opikTraceId?: string;
  source?: string;
  persisted?: boolean;
  error?: string;
};

export type GenerateStudentFacingDraftResult = {
  task: string;
  opikTraceId?: string;
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
 * Draft generation before an assignment row exists (wizard create flow).
 */
export async function generateStudentFacingTaskDraft(
  options: {
    classroomId: string;
    title: string;
    instructions: string;
    uiLanguage: 'he' | 'en';
  },
): Promise<GenerateStudentFacingDraftResult | null> {
  if (!options.classroomId || !options.instructions.trim()) return null;
  const lang = getAssignmentLanguage(options.instructions, options.uiLanguage);
  const { data, error } = await supabase.functions.invoke<GenerateStudentFacingResponse>(
    'generate-student-facing-task',
    {
      body: {
        classroomId: options.classroomId,
        title: options.title,
        instructions: options.instructions,
        language: lang,
      },
    },
  );
  if (error) {
    console.warn('generateStudentFacingTaskDraft', error);
    return null;
  }
  const task = data?.studentFacingTask?.trim() ?? '';
  if (!task) return null;
  return {
    task,
    opikTraceId: data?.opikTraceId?.trim() || undefined,
  };
}

/**
 * When `student_facing_task` is still empty, generate and persist the cognitive task card (edge function; no-op if already set).
 * Call after create, or when saving an assignment without a hand-written student summary.
 */
export async function prefillStudentFacingTaskForAssignment(
  assignmentId: string,
  options: { instructions: string; uiLanguage: 'he' | 'en' },
): Promise<string | null> {
  if (!assignmentId || !options.instructions.trim()) return null;
  const lang = getAssignmentLanguage(options.instructions, options.uiLanguage);
  const { data, error } = await ensureStudentFacingTask(assignmentId, lang);
  if (error) {
    console.warn('prefillStudentFacingTaskForAssignment', error);
    return null;
  }
  return data?.studentFacingTask?.trim() ?? null;
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
    const insertRow: Record<string, unknown> = {
      classroom_id: assignment.classroom_id,
      title: assignment.title,
      instructions: assignment.instructions,
      type: assignment.type,
      due_at: assignment.due_at,
      status: assignment.status,
      target_dimensions: assignment.target_dimensions as unknown as Json,
      personalization_flag: assignment.personalization_flag,
      enable_ai_feedback: assignment.enable_ai_feedback,
      auto_publish_ai_feedback: assignment.auto_publish_ai_feedback,
      attempt_mode: assignment.attempt_mode,
    };
    const insertPayload = Object.fromEntries(
      Object.entries(insertRow).filter(([, v]) => v !== null && v !== undefined),
    );
    const { data, error } = await activityListWriteWithUnknownColumnFallback(
      insertPayload,
      async (payload) => {
        const result = await supabase
          .from('assignments')
          .insert([payload as Database['public']['Tables']['assignments']['Insert']])
          .select()
          .single();
        return { data: result.data, error: result.error };
      },
      'No insertable fields left for assignments after dropping unknown columns.',
      'assignments INSERT stopped after exhausting schema column fallbacks; check migrations vs remote DB.',
    );

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    if (data?.id) {
      const row = data as unknown as Assignment;
      const hasTask = Boolean(String(row.student_facing_task ?? '').trim());
      const inst = String(row.instructions ?? assignment.instructions ?? '');
      const skipStudentFacingTask = assignment.type === 'live_session';
      if (!skipStudentFacingTask && !hasTask && inst.trim()) {
        await prefillStudentFacingTaskForAssignment(data.id, {
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
    const payload: Record<string, unknown> = { ...rest };
    if (target_dimensions !== undefined)
      payload.target_dimensions = target_dimensions as unknown as Json;
    if (materials !== undefined) payload.materials = materials as unknown as Json | null;
    const patchPayload = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== null && v !== undefined),
    );
    const { data, error } = await activityListWriteWithUnknownColumnFallback(
      patchPayload,
      async (mutable) => {
        const result = await supabase
          .from('assignments')
          .update(mutable as Database['public']['Tables']['assignments']['Update'])
          .eq('id', assignmentId)
          .select()
          .single();
        return { data: result.data, error: result.error };
      },
      'No updatable fields left for assignments after dropping unknown columns.',
      'assignments PATCH stopped after exhausting schema column fallbacks; check migrations vs remote DB.',
    );

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
        await prefillStudentFacingTaskForAssignment(data.id, {
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
