/**
 * Submission Service
 * Handles all submission-related operations
 */

import { supabase, handleSupabaseError } from '@/api/client';
import type {
  Submission,
  SubmissionWithDetails,
  AssignmentFeedback,
  ApiError,
  ChatRequest,
  ChatResponse,
  FeedbackRequest,
  FeedbackResponse,
} from '@/types';
import { SUBMISSION_STATUS } from '@/config/constants';

/**
 * Get or create submission for a student and assignment
 */
export const getOrCreateSubmission = async (
  assignmentId: string,
  studentId: string
): Promise<{ data: Submission | null; error: ApiError | null }> => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (fetchError) {
      return { data: null, error: handleSupabaseError(fetchError) };
    }

    if (existing) {
      return { data: existing, error: null };
    }

    const { data: newSubmission, error: createError } = await supabase
      .from('submissions')
      .insert([
        {
          assignment_id: assignmentId,
          student_id: studentId,
          status: SUBMISSION_STATUS.IN_PROGRESS,
        },
      ])
      .select()
      .single();

    if (createError) {
      return { data: null, error: handleSupabaseError(createError) };
    }

    return { data: newSubmission, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Get submission by ID
 */
export const getSubmissionById = async (
  submissionId: string
): Promise<{ data: SubmissionWithDetails | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(
        `
        *,
        assignments(title),
        student_profiles(full_name, avatar_url, user_id, created_at),
        assignment_feedback(student_feedback, teacher_feedback, created_at)
      `
      )
      .eq('id', submissionId)
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
 * Get all submissions for a classroom
 */
export const getClassroomSubmissions = async (
  classroomId: string
): Promise<{ data: SubmissionWithDetails[] | null; error: ApiError | null }> => {
  try {
    const { data: assignments, error: assignError } = await supabase
      .from('assignments')
      .select('id')
      .eq('classroom_id', classroomId);

    if (assignError || !assignments || assignments.length === 0) {
      return { data: [], error: assignError ? handleSupabaseError(assignError) : null };
    }

    const assignmentIds = assignments.map((a) => a.id);

    const { data, error } = await supabase
      .from('submissions')
      .select(
        `
        *,
        assignments(title),
        student_profiles(full_name, avatar_url, user_id, created_at),
        assignment_feedback(student_feedback, teacher_feedback, created_at)
      `
      )
      .in('assignment_id', assignmentIds)
      .eq('status', SUBMISSION_STATUS.COMPLETED)
      .order('submitted_at', { ascending: false });

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Get feedback for a submission
 */
export const getSubmissionFeedback = async (
  submissionId: string
): Promise<{ data: AssignmentFeedback | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('assignment_feedback')
      .select('*')
      .eq('submission_id', submissionId)
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
 * Send chat message to Perleap agent
 */
export const sendChatMessage = async (
  request: ChatRequest
): Promise<{ data: ChatResponse | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase.functions.invoke('perleap-chat', {
      body: request,
    });

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Generate feedback for a completed submission
 */
export const generateFeedback = async (
  request: FeedbackRequest
): Promise<{ data: FeedbackResponse | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase.functions.invoke('generate-feedback', {
      body: request,
    });

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Mark submission as completed
 */
export const completeSubmission = async (
  submissionId: string
): Promise<{ success: boolean; error: ApiError | null }> => {
  try {
    const { error } = await supabase
      .from('submissions')
      .update({
        status: SUBMISSION_STATUS.COMPLETED,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    if (error) {
      return { success: false, error: handleSupabaseError(error) };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: handleSupabaseError(error) };
  }
};
