/**
 * Analytics Service
 * Handles analytics and 5D scores operations
 */

import { supabase, handleSupabaseError } from '@/api/client';
import type {
  FiveDSnapshot,
  FiveDScores,
  StudentAnalytics,
  ClassroomAnalytics,
  ApiError,
} from '@/types';
import { SNAPSHOT_SOURCES, DEFAULT_SCORE } from '@/config/constants';

/**
 * Save 5D snapshot
 */
export const saveFiveDSnapshot = async (
  userId: string,
  scores: FiveDScores,
  source: 'onboarding' | 'assignment',
  submissionId: string | null = null,
  classroomId: string | null = null
): Promise<{ data: FiveDSnapshot | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('five_d_snapshots')
      .insert([
        {
          user_id: userId,
          scores,
          source,
          submission_id: submissionId,
          classroom_id: classroomId,
        },
      ])
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
 * Get latest 5D scores for a user
 */
export const getLatestScores = async (
  userId: string,
  excludeOnboarding = true,
  classroomId: string | null = null
): Promise<{ data: FiveDScores | null; error: ApiError | null }> => {
  try {
    let query = supabase
      .from('five_d_snapshots')
      .select('scores')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (excludeOnboarding) {
      query = query.neq('source', SNAPSHOT_SOURCES.ONBOARDING);
    }

    if (classroomId) {
      query = query.eq('classroom_id', classroomId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data: (data?.scores as FiveDScores) || null, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Get all snapshots for a user
 */
export const getUserSnapshots = async (
  userId: string,
  excludeOnboarding = true,
  classroomId: string | null = null
): Promise<{ data: FiveDSnapshot[] | null; error: ApiError | null }> => {
  try {
    let query = supabase
      .from('five_d_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (excludeOnboarding) {
      query = query.neq('source', SNAPSHOT_SOURCES.ONBOARDING);
    }

    if (classroomId) {
      query = query.eq('classroom_id', classroomId);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Calculate average scores from multiple snapshots
 */
export const calculateAverageScores = (snapshots: FiveDSnapshot[]): FiveDScores => {
  if (snapshots.length === 0) {
    return {
      vision: DEFAULT_SCORE,
      values: DEFAULT_SCORE,
      thinking: DEFAULT_SCORE,
      connection: DEFAULT_SCORE,
      action: DEFAULT_SCORE,
    };
  }

  const totals = {
    vision: 0,
    values: 0,
    thinking: 0,
    connection: 0,
    action: 0,
  };

  snapshots.forEach((snapshot) => {
    Object.keys(totals).forEach((key) => {
      totals[key as keyof FiveDScores] += snapshot.scores[key as keyof FiveDScores] || 0;
    });
  });

  return Object.keys(totals).reduce(
    (acc, key) => ({
      ...acc,
      [key]: totals[key as keyof FiveDScores] / snapshots.length,
    }),
    {} as FiveDScores
  );
};

/**
 * Get analytics for a classroom
 */
export const getClassroomAnalytics = async (
  classroomId: string,
  assignmentId: string | null = null,
  studentId: string | null = null
): Promise<{ data: ClassroomAnalytics | null; error: ApiError | null }> => {
  try {
    // 1. Get student count
    const { count: studentCount } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('classroom_id', classroomId);

    // 2. Get assignments in this classroom
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id, title')
      .eq('classroom_id', classroomId);

    const assignmentCount = assignments?.length || 0;
    const assignmentIds = assignments?.map(a => a.id) || [];

    // 3. Get enrollments with student profiles in bulk
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id, student_profiles(user_id, full_name, avatar_url)')
      .eq('classroom_id', classroomId);

    if (!enrollments || enrollments.length === 0) {
      return {
        data: {
          studentCount: studentCount || 0,
          assignmentCount,
          totalSubmissions: 0,
          completionRate: 0,
          classAverage: null,
          students: [],
        },
        error: null,
      };
    }

    const studentIds = enrollments.map(e => e.student_id);

    // 4. Fetch all submissions for these assignments in bulk
    const { data: allSubmissions } = await supabase
      .from('submissions')
      .select('id, student_id, assignment_id, status')
      .in('assignment_id', assignmentIds);

    const submissionIds = allSubmissions?.map(s => s.id) || [];

    // 5. Fetch all 5D snapshots for these submissions in bulk
    const { data: allSnapshots } = await supabase
      .from('five_d_snapshots')
      .select('user_id, submission_id, scores')
      .in('submission_id', submissionIds)
      .eq('classroom_id', classroomId);

    // 6. Fetch all feedback records in bulk
    let feedbackQuery = supabase
      .from('assignment_feedback')
      .select('student_id, assignment_id')
      .in('submission_id', submissionIds);

    if (assignmentId) {
      feedbackQuery = feedbackQuery.eq('assignment_id', assignmentId);
    }

    const { data: allFeedback } = await feedbackQuery;

    // 7. Process data into student analytics
    const studentAnalytics: StudentAnalytics[] = enrollments.map(enrollment => {
      const studentId = enrollment.student_id;
      const profile = (enrollment as any).student_profiles;
      const fullName = profile?.full_name || 'Unknown';

      // Filter snapshots for this student
      const studentSnapshots = allSnapshots?.filter(s => s.user_id === studentId) || [];
      const averageScores = studentSnapshots.length > 0 
        ? calculateAverageScores(studentSnapshots as any)
        : null;

      // Filter feedback for this student
      const studentFeedback = allFeedback?.filter(f => f.student_id === studentId) || [];

      return {
        id: studentId,
        fullName,
        latestScores: averageScores,
        feedbackCount: studentFeedback.length,
      };
    });

    const totalSubmissions = allFeedback?.length || 0;

    // Calculate class average or individual student scores
    let classAverage: FiveDScores | null = null;

    if (studentId) {
      const student = studentAnalytics.find((s) => s.id === studentId);
      classAverage = student?.latestScores || null;
    } else {
      const validScores = studentAnalytics.filter((s) => s.latestScores);
      if (validScores.length > 0) {
        const allStudentSnapshots: FiveDSnapshot[] = validScores
          .map((s) =>
            s.latestScores
              ? ({
                  scores: s.latestScores,
                } as FiveDSnapshot)
              : null
          )
          .filter((s): s is FiveDSnapshot => s !== null);
        classAverage = calculateAverageScores(allStudentSnapshots);
      }
    }

    const completionRate =
      studentCount && studentCount > 0
        ? (studentAnalytics.filter((s) => s.feedbackCount > 0).length / studentCount) * 100
        : 0;

    return {
      data: {
        studentCount: studentCount || 0,
        assignmentCount,
        totalSubmissions,
        completionRate: Math.round(completionRate),
        classAverage,
        students: studentAnalytics,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Regenerate scores for a classroom
 */
export const regenerateClassroomScores = async (
  classroomId: string
): Promise<{ success: boolean; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase.functions.invoke('regenerate-scores', {
      body: { classroomId },
    });

    if (error) {
      return { success: false, error: handleSupabaseError(error) };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: handleSupabaseError(error) };
  }
};
