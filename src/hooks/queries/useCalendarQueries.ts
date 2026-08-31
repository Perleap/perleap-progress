/**
 * Calendar Query Hooks
 * React Query hooks for calendar data
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type StudentProfileSnippet = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type EnrollmentWithProfile = {
  student_id: string;
  classroom_id: string;
  student_profiles: StudentProfileSnippet | StudentProfileSnippet[] | null;
};

type StudentClassroomRow = {
  id: string;
  name: string;
  subject: string;
  start_date: string | null;
  end_date: string | null;
};

type StudentEnrollmentRow = {
  classroom_id: string;
  classrooms: StudentClassroomRow | null;
};

type StudentCalendarAssignmentRow = {
  id: string;
  title: string;
  due_at: string | null;
  type: string;
  classrooms: { name: string; subject: string } | null;
};

export const calendarKeys = {
  all: ['calendar'] as const,
  teacher: (teacherId: string) => [...calendarKeys.all, 'teacher', teacherId] as const,
  student: (studentId: string) => [...calendarKeys.all, 'student', studentId] as const,
};

/**
 * Hook to fetch all data needed for the teacher calendar
 * @param isAdmin - when true, do not filter by teacher_id (RLS limits rows to what the user may see)
 */
export const useTeacherCalendarData = (
  teacherId: string | undefined,
  options?: { isAdmin?: boolean }
) => {
  const isAdmin = options?.isAdmin === true;
  return useQuery({
    queryKey: [...calendarKeys.teacher(teacherId || ''), isAdmin ? 'all' : 'own'] as const,
    queryFn: async () => {
      if (!teacherId) throw new Error('Missing teacher ID');

      // 1. Fetch classrooms
      let classQ = supabase
        .from('classrooms')
        .select('id, name, subject, start_date, end_date')
        .eq('active', true);
      if (!isAdmin) {
        classQ = classQ.eq('teacher_id', teacherId);
      }
      const { data: classrooms, error: classroomError } = await classQ;

      if (classroomError) throw classroomError;
      if (!classrooms || classrooms.length === 0) return { classrooms: [], assignments: [] };

      const classroomIds = classrooms.map((c) => c.id);

      // 2. Fetch assignments
      const { data: assignmentsData, error: assignError } = await supabase
        .from('assignments')
        .select('id, title, due_at, type, classroom_id, classrooms(name, subject)')
        .in('classroom_id', classroomIds)
        .eq('status', 'published')
        .order('due_at', { ascending: true });

      if (assignError) throw assignError;
      if (!assignmentsData || assignmentsData.length === 0) return { classrooms, assignments: [] };

      const assignmentIds = assignmentsData.map((a) => a.id);

      // 3. Fetch enrollments and submissions in bulk
      const [{ data: allEnrollments }, { data: allSubmissions }] = await Promise.all([
        supabase
          .from('enrollments')
          .select('student_id, classroom_id, student_profiles(user_id, full_name, avatar_url)')
          .in('classroom_id', classroomIds),
        supabase
          .from('submissions')
          .select('student_id, assignment_id')
          .in('assignment_id', assignmentIds),
      ]);

      // 4. Process student profiles into a map
      const studentProfilesMap = new Map<string, StudentProfileSnippet>();
      allEnrollments?.forEach((e) => {
        const row = e as EnrollmentWithProfile;
        const profile = Array.isArray(row.student_profiles)
          ? row.student_profiles[0]
          : row.student_profiles;
        if (profile) {
          studentProfilesMap.set(e.student_id, profile);
        }
      });

      // 5. Process data
      const enrollmentsByClassroom = new Map<string, string[]>();
      allEnrollments?.forEach((e) => {
        if (!enrollmentsByClassroom.has(e.classroom_id))
          enrollmentsByClassroom.set(e.classroom_id, []);
        const enrolled = enrollmentsByClassroom.get(e.classroom_id);
        if (enrolled) enrolled.push(e.student_id);
      });

      const submissionsByAssignment = new Map<string, string[]>();
      allSubmissions?.forEach((s) => {
        if (!submissionsByAssignment.has(s.assignment_id))
          submissionsByAssignment.set(s.assignment_id, []);
        const submitted = submissionsByAssignment.get(s.assignment_id);
        if (submitted) submitted.push(s.student_id);
      });

      const assignmentsWithIncomplete = assignmentsData.map((assignment) => {
        const enrolledStudentIds = enrollmentsByClassroom.get(assignment.classroom_id) || [];
        const completedStudentIds = submissionsByAssignment.get(assignment.id) || [];
        const incompleteStudentIds = enrolledStudentIds.filter(
          (id) => !completedStudentIds.includes(id)
        );

        const incompleteStudents = incompleteStudentIds
          .map((id) => studentProfilesMap.get(id))
          .filter((s): s is NonNullable<typeof s> => Boolean(s));

        return {
          ...assignment,
          incompleteStudents,
          totalStudents: enrolledStudentIds.length,
        };
      });

      return {
        classrooms,
        assignments: assignmentsWithIncomplete,
      };
    },
    enabled: !!teacherId,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook to fetch all data needed for the student calendar
 */
export const useStudentCalendarData = (studentId: string | undefined) => {
  return useQuery({
    queryKey: calendarKeys.student(studentId || ''),
    queryFn: async () => {
      if (!studentId) throw new Error('Missing student ID');

      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('classroom_id, classrooms(id, name, subject, start_date, end_date)')
        .eq('student_id', studentId);

      if (enrollError) throw enrollError;

      if (!enrollments?.length) {
        return { classrooms: [], assignments: [] };
      }

      const classroomIds = enrollments.map((e) => e.classroom_id);
      const classroomsData = (enrollments as StudentEnrollmentRow[])
        .map((e) => e.classrooms)
        .filter((c): c is StudentClassroomRow => c != null);

      const { data: assignmentsData, error: assignError } = await supabase
        .from('assignments')
        .select('id, title, due_at, type, classrooms(name, subject)')
        .in('classroom_id', classroomIds)
        .eq('status', 'published')
        .order('due_at', { ascending: true });

      if (assignError) throw assignError;

      return {
        classrooms: classroomsData,
        assignments: (assignmentsData ?? []) as StudentCalendarAssignmentRow[],
      };
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
  });
};
