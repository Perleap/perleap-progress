/**
 * Analytics Query Hooks
 * React Query hooks for classroom and student analytics
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const analyticsKeys = {
  all: ['analytics'] as const,
  classroom: (classroomId: string) => [...analyticsKeys.all, 'classroom', classroomId] as const,
  student: (studentId: string, classroomId: string) => [...analyticsKeys.all, 'student', studentId, classroomId] as const,
};

/**
 * Hook to fetch classroom analytics data
 */
export const useClassroomAnalytics = (classroomId: string | undefined) => {
  return useQuery({
    queryKey: analyticsKeys.classroom(classroomId || ''),
    queryFn: async () => {
      if (!classroomId) throw new Error('Missing classroom ID');

      // 1. Fetch enrollment count
      const { count: studentCount } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('classroom_id', classroomId);

      // 2. Fetch assignments
      const { data: assignments } = await supabase
        .from('assignments')
        .select('id, title')
        .eq('classroom_id', classroomId);

      // 3. Fetch enrollments with student profiles in bulk
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id, student_profiles(user_id, full_name, avatar_url)')
        .eq('classroom_id', classroomId);

      const studentIds = enrollments?.map(e => e.student_id) || [];
      const profileMap = new Map(
        enrollments?.map(e => [e.student_id, (e as any).student_profiles]) || []
      );

      // 5. Fetch all submissions for these assignments
      const assignmentIds = assignments?.map(a => a.id) || [];
      const { data: allSubmissions } = await supabase
        .from('submissions')
        .select('id, student_id, assignment_id, status')
        .in('assignment_id', assignmentIds);

      const submissionIds = allSubmissions?.map(s => s.id) || [];

      // 6. Fetch 5D snapshots in bulk
      const { data: snapshots } = await supabase
        .from('five_d_snapshots')
        .select('user_id, submission_id, scores')
        .in('submission_id', submissionIds)
        .eq('classroom_id', classroomId)
        .neq('source', 'onboarding');

      // 7. Fetch feedback counts in bulk
      const { data: feedbackData } = await supabase
        .from('assignment_feedback')
        .select('submission_id, student_id, assignment_id')
        .in('submission_id', submissionIds);

      // 8. Fetch hard skill assessments in bulk
      const { data: hardSkills } = await supabase
        .from('hard_skill_assessments')
        .select('*')
        .in('submission_id', submissionIds);

      // Process data into the format needed by ClassroomAnalytics
      const processedStudents = studentIds.map(sid => {
        const profile = profileMap.get(sid);
        const studentSubmissions = allSubmissions?.filter(s => s.student_id === sid) || [];
        const studentSnapshots = snapshots?.filter(s => s.user_id === sid) || [];
        const studentFeedback = feedbackData?.filter(f => f.student_id === sid) || [];
        const studentHardSkills = hardSkills?.filter(h => h.student_id === sid) || [];

        // Calculate average scores for this student
        let averageScores = null;
        if (studentSnapshots.length > 0) {
          const totals = { vision: 0, values: 0, thinking: 0, connection: 0, action: 0 };
          studentSnapshots.forEach(s => {
            const scores = s.scores as any;
            Object.keys(totals).forEach(k => {
              totals[k as keyof typeof totals] += scores[k] || 0;
            });
          });
          averageScores = Object.keys(totals).reduce((acc, k) => ({
            ...acc,
            [k]: totals[k as keyof typeof totals] / studentSnapshots.length
          }), {} as any);
        }

        return {
          id: sid,
          fullName: profile?.full_name || 'Unknown',
          latestScores: averageScores,
          feedbackCount: studentFeedback.length,
          submissions: studentSubmissions,
          snapshots: studentSnapshots,
          hardSkills: studentHardSkills
        };
      });

      return {
        studentCount: studentCount || 0,
        assignmentCount: assignments?.length || 0,
        assignments: assignments || [],
        students: processedStudents,
        allStudents: processedStudents.map(s => ({ id: s.id, name: s.fullName })),
        rawSubmissions: allSubmissions || [],
        rawSnapshots: snapshots || [],
        rawFeedback: feedbackData || [],
        rawHardSkills: hardSkills || []
      };
    },
    enabled: !!classroomId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};
