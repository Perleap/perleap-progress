/**
 * Activity Query Hooks
 * React Query hooks for activity events
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveUserDisplayProfiles } from '@/lib/resolveUserDisplayProfiles';

export const activityKeys = {
  all: ['activity'] as const,
  recent: (userId: string) => [...activityKeys.all, 'recent', userId] as const,
};

/**
 * Hook to fetch recent activity for a teacher
 */
export const useRecentActivity = (
  userId: string | undefined,
  teacherProfile: any,
  options?: { isAppAdmin?: boolean }
) => {
  const isAppAdmin = options?.isAppAdmin === true;
  return useQuery({
    queryKey: [...activityKeys.recent(userId || ''), isAppAdmin ? 'all' : 'own'] as const,
    queryFn: async () => {
      if (!userId) throw new Error('Missing user ID');

      let evQ = supabase
        .from('activity_events' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (!isAppAdmin) {
        evQ = evQ.eq('teacher_id', userId);
      }
      const { data: events, error } = await evQ;

      if (error) throw error;
      const rawEvents = (events as any[]) || [];

      // Fetch performer info for each event
      const submissionIds = rawEvents
        .filter((e: any) => e.entity_type === 'submission')
        .map((e: any) => e.entity_id);

      let studentProfilesMap: Record<string, { name: string; avatar_url: string }> = {};
      let submissionById: Record<string, { student_id: string; is_teacher_attempt: boolean }> = {};

      if (submissionIds.length > 0) {
        const { data: submissions } = await supabase
          .from('submissions')
          .select('id, student_id, is_teacher_attempt')
          .in('id', submissionIds);

        const profileMap = await resolveUserDisplayProfiles(
          supabase,
          submissions?.map((s) => s.student_id) ?? [],
        );

        if (submissions && submissions.length > 0) {
          studentProfilesMap = submissions.reduce((acc, s) => {
            const profile = profileMap.get(s.student_id);
            if (profile) {
              acc[s.id] = { name: profile.full_name ?? 'Unknown', avatar_url: profile.avatar_url ?? '' };
            }
            return acc;
          }, {} as any);
          submissionById = submissions.reduce(
            (acc, s) => {
              acc[s.id] = {
                student_id: s.student_id,
                is_teacher_attempt: Boolean(s.is_teacher_attempt),
              };
              return acc;
            },
            {} as Record<string, { student_id: string; is_teacher_attempt: boolean }>,
          );
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

        let title = event.title as string;
        if (
          event.entity_type === 'submission' &&
          typeof title === 'string' &&
          title.startsWith('Student submitted ')
        ) {
          const meta = submissionById[event.entity_id];
          if (
            meta &&
            (meta.is_teacher_attempt || meta.student_id === event.teacher_id)
          ) {
            const suffix = title.slice('Student submitted '.length);
            const who = (performer?.name ?? 'Teacher').trim() || 'Teacher';
            title = `${who} submitted ${suffix}`;
          }
        }

        let route = event.route;
        if (event.entity_type === 'submission' && event.entity_id) {
          route = `/teacher/submission/${event.entity_id}`;
        }

        return {
          ...event,
          title,
          performer,
          route
        };
      });
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
  });
};
