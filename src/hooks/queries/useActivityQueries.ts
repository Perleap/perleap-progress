/**
 * Activity Query Hooks
 * React Query hooks for activity events
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const activityKeys = {
  all: ['activity'] as const,
  recent: (userId: string) => [...activityKeys.all, 'recent', userId] as const,
};

/**
 * Hook to fetch recent activity for a teacher
 */
export const useRecentActivity = (userId: string | undefined, teacherProfile: any) => {
  return useQuery({
    queryKey: activityKeys.recent(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('Missing user ID');

      const { data: events, error } = await supabase
        .from('activity_events' as any)
        .select('*')
        .eq('teacher_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      const rawEvents = (events as any[]) || [];

      // Fetch performer info for each event
      const submissionIds = rawEvents
        .filter((e: any) => e.entity_type === 'submission')
        .map((e: any) => e.entity_id);

      let studentProfilesMap: Record<string, { name: string; avatar_url: string }> = {};

      if (submissionIds.length > 0) {
        const { data: submissions } = await supabase
          .from('submissions')
          .select('id, student_id')
          .in('id', submissionIds);

        if (submissions && submissions.length > 0) {
          const studentIds = submissions.map(s => s.student_id);
          const { data: profiles } = await supabase
            .from('student_profiles')
            .select('user_id, full_name, avatar_url')
            .in('user_id', studentIds);

          if (profiles) {
            const profileLookup = profiles.reduce((acc, p) => {
              acc[p.user_id] = { name: p.full_name, avatar_url: p.avatar_url };
              return acc;
            }, {} as any);

            studentProfilesMap = submissions.reduce((acc, s) => {
              if (profileLookup[s.student_id]) {
                acc[s.id] = profileLookup[s.student_id];
              }
              return acc;
            }, {} as any);
          }
        }
      }

      return rawEvents.map((event: any) => {
        let performer = {
          name: teacherProfile?.full_name || 'Teacher',
          avatar_url: teacherProfile?.avatar_url
        };

        if (event.entity_type === 'submission' && studentProfilesMap[event.entity_id]) {
          performer = studentProfilesMap[event.entity_id];
        }

        let route = event.route;
        if (event.entity_type === 'submission' && event.entity_id) {
          route = `/teacher/submission/${event.entity_id}`;
        }

        return {
          ...event,
          performer,
          route
        };
      });
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
  });
};
