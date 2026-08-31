import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { TeacherProfileDisplay } from '@/types/models';
import { supabase } from '@/integrations/supabase/client';

export type TeacherProfileSummary = TeacherProfileDisplay;

export type TeacherProfilesMap = Record<string, TeacherProfileSummary>;

export const teacherProfilesMapKeys = {
  batch: (idsKey: string) => ['teacherProfiles', 'batch', idsKey] as const,
};

async function fetchTeacherProfilesMap(idsKey: string): Promise<TeacherProfilesMap> {
  const ids = idsKey.split('|').filter(Boolean);
  const { data, error } = await supabase
    .from('teacher_profiles')
    .select('user_id, full_name, avatar_url')
    .in('user_id', ids);

  if (error) throw error;

  const map: TeacherProfilesMap = {};
  for (const row of data ?? []) {
    map[row.user_id] = {
      full_name: row.full_name || '',
      avatar_url: row.avatar_url ?? null,
    };
  }
  return map;
}

/** Batch-fetch teacher display profiles keyed by user_id. */
export function useTeacherProfilesMap(teacherIds: string[]) {
  const idsKey = useMemo(
    () => [...new Set(teacherIds.filter(Boolean))].sort().join('|'),
    [teacherIds]
  );

  const query = useQuery({
    queryKey: teacherProfilesMapKeys.batch(idsKey),
    queryFn: () => fetchTeacherProfilesMap(idsKey),
    enabled: idsKey.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return {
    teacherProfiles: query.data ?? {},
    isPending: query.isPending && idsKey.length > 0,
    isLoading: query.isLoading,
  };
}
