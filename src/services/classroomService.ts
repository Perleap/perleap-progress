/**
 * Classroom Service
 * Handles all classroom-related operations
 */

import type { Database, Json } from '@/integrations/supabase/types';
import type { StorageUploadOptions } from '@/lib/storageUpload';
import type { Classroom, Enrollment, EnrolledStudent, ApiError } from '@/types';
import type {
  ClassroomResetResult,
  ClassroomResetScopeCounts,
  ClassroomWithEnrollmentCount,
} from '@/types/api.types';
import { supabase, handleSupabaseError } from '@/api/client';

function enrollmentCountFromRow(enrollments: { count: number }[] | null | undefined): number {
  return enrollments?.[0]?.count ?? 0;
}

function mapClassroomWithEnrollmentCount(
  classroom: Database['public']['Tables']['classrooms']['Row'] & {
    enrollments?: { count: number }[];
  }
): ClassroomWithEnrollmentCount {
  const { enrollments, ...rest } = classroom;
  return {
    ...(rest as unknown as Classroom),
    _count: {
      enrollments: enrollmentCountFromRow(enrollments),
    },
  };
}

/**
 * Fetch all classrooms for a teacher with enrollment counts.
 * For app admins, omit `teacherId` filter so RLS returns all accessible classrooms.
 */
export const getTeacherClassrooms = async (
  teacherId: string,
  options?: { allClassroomsForAdmin?: boolean }
): Promise<{ data: ClassroomWithEnrollmentCount[] | null; error: ApiError | null }> => {
  try {
    let q = supabase.from('classrooms').select('*, enrollments(count)').eq('active', true);
    if (!options?.allClassroomsForAdmin) {
      q = q.eq('teacher_id', teacherId);
    }
    const { data, error } = await q;

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    const transformed = data?.map(mapClassroomWithEnrollmentCount);

    return { data: transformed ?? null, error: null };
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
): Promise<{ data: ClassroomWithEnrollmentCount | null; error: ApiError | null }> => {
  try {
    let query = supabase.from('classrooms').select('*, enrollments(count)').eq('id', classroomId);

    if (teacherId) {
      query = query.eq('teacher_id', teacherId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    if (!data) return { data: null, error: null };

    return { data: mapClassroomWithEnrollmentCount(data), error: null };
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
    const insert: Database['public']['Tables']['classrooms']['Insert'] = {
      ...classroom,
      domains: classroom.domains as unknown as Json | null,
      learning_outcomes: classroom.learning_outcomes as unknown as Json | null,
      key_challenges: classroom.key_challenges as unknown as Json | null,
      materials: classroom.materials as unknown as Json | null,
    };
    const { data, error } = await supabase.from('classrooms').insert([insert]).select().single();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data: data as unknown as Classroom, error: null };
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
    const { domains, learning_outcomes, key_challenges, materials, _count, ...rest } = updates;
    const payload: Database['public']['Tables']['classrooms']['Update'] = { ...rest };
    if (domains !== undefined) payload.domains = domains as unknown as Json | null;
    if (learning_outcomes !== undefined)
      payload.learning_outcomes = learning_outcomes as unknown as Json | null;
    if (key_challenges !== undefined)
      payload.key_challenges = key_challenges as unknown as Json | null;
    if (materials !== undefined) payload.materials = materials as unknown as Json | null;

    const { data, error } = await supabase
      .from('classrooms')
      .update(payload)
      .eq('id', classroomId)
      .select()
      .single();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data: data as unknown as Classroom, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Soft-delete a classroom (set active=false, deleted_at). Returns whether a row was updated.
 * When restrictToTeacherId is set, only that teacher's classroom can be deleted.
 */
export const softDeleteClassroom = async (
  classroomId: string,
  options?: { restrictToTeacherId?: string }
): Promise<{ deleted: boolean; error: ApiError | null }> => {
  try {
    const deletedAt = new Date().toISOString();
    let query = supabase
      .from('classrooms')
      .update({ active: false, deleted_at: deletedAt })
      .eq('id', classroomId)
      .eq('active', true);
    if (options?.restrictToTeacherId) {
      query = query.eq('teacher_id', options.restrictToTeacherId);
    }
    const { data, error } = await query.select('id');
    if (error) {
      return { deleted: false, error: handleSupabaseError(error) };
    }
    return { deleted: (data?.length ?? 0) > 0, error: null };
  } catch (error) {
    return { deleted: false, error: handleSupabaseError(error) };
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
      .select(
        `
        id, 
        created_at, 
        student_id,
        student_profiles(user_id, full_name, avatar_url, created_at)
      `
      )
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
    const { data: rpcData, error } = await supabase.rpc('find_classroom_by_invite_code', {
      p_invite_code: inviteCode.toUpperCase(),
    });

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    if (!rpcData || typeof rpcData !== 'object') {
      return { data: null, error: null };
    }

    const row = rpcData as { id?: string; name?: string; teacher_id?: string };
    if (!row.id) {
      return { data: null, error: null };
    }

    return {
      data: {
        id: row.id,
        name: row.name ?? '',
        teacher_id: row.teacher_id ?? '',
      } as Classroom,
      error: null,
    };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/** Stable code for i18n; message is English fallback for logs/non-UI callers */
const ALREADY_ENROLLED_ERROR: ApiError = {
  code: 'ALREADY_ENROLLED',
  message: 'You are already enrolled in this classroom',
};

function isEnrollmentUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  return (
    e.code === '23505' ||
    (typeof e.message === 'string' && e.message.includes('enrollments_classroom_id_student_id_key'))
  );
}

/**
 * Join a classroom (create enrollment)
 */
export const joinClassroom = async (
  classroomId: string,
  studentId: string
): Promise<{ data: Enrollment | null; error: ApiError | null }> => {
  try {
    const { enrolled, error: checkError } = await isStudentEnrolled(classroomId, studentId);
    if (checkError) {
      return { data: null, error: checkError };
    }
    if (enrolled) {
      return { data: null, error: ALREADY_ENROLLED_ERROR };
    }

    const { data, error } = await supabase
      .from('enrollments')
      .insert([{ classroom_id: classroomId, student_id: studentId }])
      .select()
      .single();

    if (error) {
      if (isEnrollmentUniqueViolation(error)) {
        return { data: null, error: ALREADY_ENROLLED_ERROR };
      }
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    if (isEnrollmentUniqueViolation(error)) {
      return { data: null, error: ALREADY_ENROLLED_ERROR };
    }
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

    return { data: data as unknown as Classroom[], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

function parseClassroomResetScopeCounts(raw: unknown): ClassroomResetScopeCounts | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const num = (k: string) => (typeof o[k] === 'number' ? o[k] : Number(o[k] ?? 0));
  return {
    active_enrollments: num('active_enrollments'),
    submissions: num('submissions'),
    module_flow_progress: num('module_flow_progress'),
    section_progress: num('section_progress'),
    memory_and_nuance_rows: num('memory_and_nuance_rows'),
    assignments_preserved: num('assignments_preserved'),
  };
}

/**
 * Preview what a classroom reset would remove (read-only).
 */
export const previewClassroomReset = async (
  classroomId: string
): Promise<{ data: ClassroomResetScopeCounts | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase.rpc('teacher_preview_classroom_reset', {
      p_classroom_id: classroomId,
    });
    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: parseClassroomResetScopeCounts(data), error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Reset a classroom: remove all students and their work; preserve course structure.
 */
export const resetClassroom = async (
  classroomId: string
): Promise<{ data: ClassroomResetResult | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase.rpc('teacher_reset_classroom', {
      p_classroom_id: classroomId,
    });
    if (error) return { data: null, error: handleSupabaseError(error) };

    if (!data || typeof data !== 'object') {
      return { data: null, error: { message: 'Invalid reset response' } };
    }

    const payload = data as Record<string, unknown>;
    const before = parseClassroomResetScopeCounts(payload.before);
    const after = parseClassroomResetScopeCounts(payload.after);
    const deletedRaw = payload.deleted;
    if (!before || !after || !deletedRaw || typeof deletedRaw !== 'object') {
      return { data: null, error: { message: 'Invalid reset response shape' } };
    }
    const d = deletedRaw as Record<string, unknown>;
    const n = (k: string) => (typeof d[k] === 'number' ? d[k] : Number(d[k] ?? 0));

    return {
      data: {
        before,
        after,
        deleted: {
          submissions: n('submissions'),
          nuance_events: n('nuance_events'),
          module_flow_progress: n('module_flow_progress'),
          section_progress: n('section_progress'),
          section_comments: n('section_comments'),
          enrollments_unenrolled: n('enrollments_unenrolled'),
          assignments_student_target_cleared: n('assignments_student_target_cleared'),
        },
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export async function rephraseCourseDescription(
  text: string,
  language: 'he' | 'en'
): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ rephrasedText?: string }>(
    'rephrase-text',
    { body: { text, language } }
  );
  if (error) throw error;
  if (!data?.rephrasedText) throw new Error('No rephrased text returned');
  return data.rephrasedText;
}

export async function uploadCourseMaterialPdf(
  userId: string,
  file: File,
  onUploadProgress?: (percentage: number) => void
): Promise<{ filePath: string; displayName: string }> {
  const fileName = `${userId}/${Date.now()}.pdf`;
  const uploadOptions: StorageUploadOptions = {
    cacheControl: '3600',
    upsert: true,
    ...(onUploadProgress
      ? {
          onUploadProgress: (progress) => {
            if (progress.total <= 0) return;
            onUploadProgress(Math.round((progress.loaded / progress.total) * 100));
          },
        }
      : {}),
  };
  const { error } = await supabase.storage
    .from('course-materials')
    .upload(fileName, file, uploadOptions);
  if (error) throw error;
  return { filePath: fileName, displayName: file.name };
}
