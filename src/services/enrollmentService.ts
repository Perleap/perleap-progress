import { supabase } from '@/integrations/supabase/client';
import { createNotification } from '@/lib/notificationService';

/**
 * Enrollment Service
 * Handles classroom enrollment operations
 */

export interface EnrollmentResult {
  success: boolean;
  classroomId?: string;
  classroomName?: string;
  error?: string;
}

/**
 * Enroll a student in a classroom using invite code
 *
 * @param inviteCode - Classroom invite code
 * @param studentId - Student user ID
 * @param studentName - Student full name for notifications
 * @returns Enrollment result
 */
export const enrollInClassroom = async (
  inviteCode: string,
  studentId: string,
  studentName: string
): Promise<EnrollmentResult> => {
  try {
    const trimmedCode = inviteCode.trim().toUpperCase();

    // Find classroom by invite code
    const { data: classroom, error: classroomError } = await supabase
      .from('classrooms')
      .select('id, name, teacher_id')
      .eq('invite_code', trimmedCode)
      .maybeSingle();

    if (classroomError) {
      return {
        success: false,
        error: 'Error checking invite code',
      };
    }

    if (!classroom) {
      return {
        success: false,
        error: `No classroom found with code: ${trimmedCode}`,
      };
    }

    // Check if already enrolled
    const { data: existingEnrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('classroom_id', classroom.id)
      .eq('student_id', studentId)
      .maybeSingle();

    if (existingEnrollment) {
      return {
        success: false,
        error: 'You are already enrolled in this classroom',
      };
    }

    // Create enrollment
    const { error: enrollError } = await supabase.from('enrollments').insert({
      classroom_id: classroom.id,
      student_id: studentId,
    });

    if (enrollError) {
      return {
        success: false,
        error: 'Failed to join classroom',
      };
    }

    // Notify teacher
    await createNotification(
      classroom.teacher_id,
      'student_enrolled',
      'New Student Enrolled',
      `${studentName} joined ${classroom.name}`,
      `/teacher/classroom/${classroom.id}`,
      {
        classroom_id: classroom.id,
        student_id: studentId,
        student_name: studentName,
        classroom_name: classroom.name,
      }
    );

    // Notify student
    await createNotification(
      studentId,
      'enrolled_in_classroom',
      'Successfully Enrolled',
      `You've joined ${classroom.name}`,
      `/student/classroom/${classroom.id}`,
      {
        classroom_id: classroom.id,
        classroom_name: classroom.name,
      },
      classroom.teacher_id
    );

    return {
      success: true,
      classroomId: classroom.id,
      classroomName: classroom.name,
    };
  } catch (error) {
    console.error('Error enrolling in classroom:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
};

/**
 * Unenroll a student from a classroom
 *
 * @param classroomId - Classroom ID
 * @param studentId - Student user ID
 * @returns Success status
 */
export const unenrollFromClassroom = async (
  classroomId: string,
  studentId: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('classroom_id', classroomId)
      .eq('student_id', studentId);

    return !error;
  } catch (error) {
    console.error('Error unenrolling from classroom:', error);
    return false;
  }
};

/**
 * Get all students enrolled in a classroom
 *
 * @param classroomId - Classroom ID
 * @returns Array of enrolled students
 */
export const getEnrolledStudents = async (classroomId: string) => {
  try {
    const { data, error } = await supabase
      .from('enrollments')
      .select('student_id, created_at, student_profiles(user_id, full_name, avatar_url)')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching enrolled students:', error);
    return [];
  }
};

/**
 * Check if a student is enrolled in a classroom
 *
 * @param classroomId - Classroom ID
 * @param studentId - Student user ID
 * @returns Enrollment status
 */
export const isEnrolled = async (classroomId: string, studentId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('enrollments')
      .select('id')
      .eq('classroom_id', classroomId)
      .eq('student_id', studentId)
      .maybeSingle();

    return !error && data !== null;
  } catch (error) {
    console.error('Error checking enrollment:', error);
    return false;
  }
};
