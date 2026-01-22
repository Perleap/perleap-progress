/**
 * Classroom Service
 * Handles all classroom-related operations
 */

import { supabase, handleSupabaseError } from '@/api/client';
import type {
  Classroom,
  Enrollment,
  EnrolledStudent,
  ApiError,
  CreateAssignmentInput,
} from '@/types';

/**
 * Fetch all classrooms for a teacher with enrollment counts
 */
export const getTeacherClassrooms = async (
  teacherId: string
): Promise<{ data: any[] | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('classrooms')
      .select('*, enrollments(count)')
      .eq('teacher_id', teacherId);

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    // Transform Supabase response to include _count.enrollments
    const transformed = data?.map(classroom => ({
      ...classroom,
      _count: {
        enrollments: (classroom.enrollments?.[0] as any)?.count || 0
      }
    }));

    return { data: transformed, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Fetch classroom by ID with enrollment count
 */
export const getClassroomById = async (
  classroomId: string,
  teacherId?: string
): Promise<{ data: any | null; error: ApiError | null }> => {
  try {
    let query = supabase
      .from('classrooms')
      .select('*, enrollments(count)')
      .eq('id', classroomId);

    if (teacherId) {
      query = query.eq('teacher_id', teacherId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    if (!data) return { data: null, error: null };

    // Transform Supabase response to include _count.enrollments
    const transformed = {
      ...data,
      _count: {
        enrollments: (data.enrollments?.[0] as any)?.count || 0
      }
    };

    return { data: transformed, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Create a new classroom
 */
export const createClassroom = async (
  classroom: Omit<Classroom, 'id' | 'created_at' | 'invite_code'>
): Promise<{ data: Classroom | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase.from('classrooms').insert([classroom]).select().single();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Update classroom
 */
export const updateClassroom = async (
  classroomId: string,
  updates: Partial<Omit<Classroom, 'id' | 'created_at' | 'invite_code' | 'teacher_id'>>
): Promise<{ data: Classroom | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('classrooms')
      .update(updates)
      .eq('id', classroomId)
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
 * Get enrollments for a classroom
 */
export const getClassroomEnrollments = async (
  classroomId: string
): Promise<{ data: Enrollment[] | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('enrollments')
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
 * Get enrolled students with profiles
 */
export const getEnrolledStudents = async (
  classroomId: string
): Promise<{ data: EnrolledStudent[] | null; error: ApiError | null }> => {
  try {
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select(`
        id, 
        created_at, 
        student_id,
        student_profiles(user_id, full_name, avatar_url, created_at)
      `)
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false });

    if (enrollError || !enrollments) {
      return { data: null, error: handleSupabaseError(enrollError) };
    }

    return { data: enrollments as unknown as EnrolledStudent[], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Find classroom by invite code
 */
export const findClassroomByInviteCode = async (
  inviteCode: string
): Promise<{ data: Classroom | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('classrooms')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
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
 * Join a classroom (create enrollment)
 */
export const joinClassroom = async (
  classroomId: string,
  studentId: string
): Promise<{ data: Enrollment | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('enrollments')
      .insert([{ classroom_id: classroomId, student_id: studentId }])
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
 * Check if student is already enrolled
 */
export const isStudentEnrolled = async (
  classroomId: string,
  studentId: string
): Promise<{ enrolled: boolean; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('enrollments')
      .select('id')
      .eq('classroom_id', classroomId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) {
      return { enrolled: false, error: handleSupabaseError(error) };
    }

    return { enrolled: !!data, error: null };
  } catch (error) {
    return { enrolled: false, error: handleSupabaseError(error) };
  }
};

/**
 * Get student's enrolled classrooms
 */
export const getStudentClassrooms = async (
  studentId: string
): Promise<{ data: Classroom[] | null; error: ApiError | null }> => {
  try {
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('classroom_id')
      .eq('student_id', studentId);

    if (enrollError || !enrollments || enrollments.length === 0) {
      return { data: [], error: enrollError ? handleSupabaseError(enrollError) : null };
    }

    const classroomIds = enrollments.map((e) => e.classroom_id);

    const { data, error } = await supabase.from('classrooms').select('*').in('id', classroomIds);

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};
