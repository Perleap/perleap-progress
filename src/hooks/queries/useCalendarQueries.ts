/**
 * Calendar Query Hooks
 * React Query hooks for calendar data
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const calendarKeys = {
  all: ['calendar'] as const,
  teacher: (teacherId: string) => [...calendarKeys.all, 'teacher', teacherId] as const,
  student: (studentId: string) => [...calendarKeys.all, 'student', studentId] as const,
};

/**
 * Hook to fetch all data needed for the teacher calendar
 */
export const useTeacherCalendarData = (teacherId: string | undefined) => {
  return useQuery({
    queryKey: calendarKeys.teacher(teacherId || ''),
    queryFn: async () => {
      if (!teacherId) throw new Error('Missing teacher ID');

      // 1. Fetch classrooms
      const { data: classrooms, error: classroomError } = await supabase
        .from('classrooms')
        .select('id, name, subject, start_date, end_date')
        .eq('teacher_id', teacherId);

      if (classroomError) throw classroomError;
      if (!classrooms || classrooms.length === 0) return { classrooms: [], assignments: [] };

      const classroomIds = classrooms.map(c => c.id);

      // 2. Fetch assignments
      const { data: assignmentsData, error: assignError } = await supabase
        .from('assignments')
        .select('id, title, due_at, type, classroom_id, classrooms(name, subject)')
        .in('classroom_id', classroomIds)
        .eq('status', 'published')
        .order('due_at', { ascending: true });

      if (assignError) throw assignError;
      if (!assignmentsData || assignmentsData.length === 0) return { classrooms, assignments: [] };

      const assignmentIds = assignmentsData.map(a => a.id);

      // 3. Fetch enrollments and submissions in bulk
      const [{ data: allEnrollments }, { data: allSubmissions }] = await Promise.all([
        supabase
          .from('enrollments')
          .select('student_id, classroom_id, student_profiles(user_id, full_name, avatar_url)')
          .in('classroom_id', classroomIds),
        supabase
          .from('submissions')
          .select('student_id, assignment_id')
          .in('assignment_id', assignmentIds)
      ]);

      // 4. Process student profiles into a map
      const studentProfilesMap = new Map();
      allEnrollments?.forEach(e => {
        if ((e as any).student_profiles) {
          studentProfilesMap.set(e.student_id, (e as any).student_profiles);
        }
      });

      // 5. Process data
      const enrollmentsByClassroom = new Map();
      allEnrollments?.forEach(e => {
        if (!enrollmentsByClassroom.has(e.classroom_id)) enrollmentsByClassroom.set(e.classroom_id, []);
        enrollmentsByClassroom.get(e.classroom_id).push(e.student_id);
      });

      const submissionsByAssignment = new Map();
      allSubmissions?.forEach(s => {
        if (!submissionsByAssignment.has(s.assignment_id)) submissionsByAssignment.set(s.assignment_id, []);
        submissionsByAssignment.get(s.assignment_id).push(s.student_id);
      });

      const assignmentsWithIncomplete = assignmentsData.map(assignment => {
        const enrolledStudentIds = enrollmentsByClassroom.get(assignment.classroom_id) || [];
        const completedStudentIds = submissionsByAssignment.get(assignment.id) || [];
        const incompleteStudentIds = enrolledStudentIds.filter(id => !completedStudentIds.includes(id));

        const incompleteStudents = incompleteStudentIds
          .map(id => studentProfilesMap.get(id))
          .filter(Boolean);

        return {
          ...assignment,
          incompleteStudents,
          totalStudents: enrolledStudentIds.length,
        };
      });

      return {
        classrooms,
        assignments: assignmentsWithIncomplete
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
      const classroomsData = enrollments.map((e) => e.classrooms).filter(Boolean) as any[];

      const { data: assignmentsData, error: assignError } = await supabase
        .from('assignments')
        .select('id, title, due_at, type, classrooms(name, subject)')
        .in('classroom_id', classroomIds)
        .eq('status', 'published')
        .order('due_at', { ascending: true });

      if (assignError) throw assignError;

      return {
        classrooms: classroomsData,
        assignments: (assignmentsData as any[]) || []
      };
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
  });
};
