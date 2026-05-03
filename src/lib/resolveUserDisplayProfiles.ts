import type { SupabaseClient } from '@supabase/supabase-js';

export type UserDisplayProfileRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

/**
 * Resolve display names for submission owners. `submissions.student_id` references auth.users;
 * PostgREST cannot embed `student_profiles` from submissions. Teachers (preview rows) live in teacher_profiles.
 */
export async function resolveUserDisplayProfiles(
  client: SupabaseClient,
  userIds: (string | null | undefined)[],
): Promise<Map<string, UserDisplayProfileRow>> {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, UserDisplayProfileRow>();
  if (unique.length === 0) return map;

  const { data: students } = await client
    .from('student_profiles')
    .select('user_id, full_name, avatar_url')
    .in('user_id', unique);

  for (const row of students ?? []) {
    map.set(row.user_id, {
      user_id: row.user_id,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
    });
  }

  const missing = unique.filter((id) => !map.has(id));
  if (missing.length === 0) return map;

  const { data: teachers } = await client
    .from('teacher_profiles')
    .select('user_id, full_name, avatar_url')
    .in('user_id', missing);

  for (const row of teachers ?? []) {
    map.set(row.user_id, {
      user_id: row.user_id,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
    });
  }

  return map;
}
