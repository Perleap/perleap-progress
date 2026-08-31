import { useQuery } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { USER_ROLES } from '@/config/constants';
import { profileKeys } from '@/hooks/queries';
import { getTeacherProfile, getStudentProfile } from '@/services/profileService';
import type { AuthUserProfile } from './types';

export function useAuthProfileQuery(user: User | null) {
  const {
    data: profileData,
    isLoading: isProfileQueryLoading,
    isFetched: isProfileFetched,
    refetch,
  } = useQuery({
    queryKey:
      user?.user_metadata?.role === USER_ROLES.ADMIN
        ? (['auth', 'admin-profile', user?.id || ''] as const)
        : user?.user_metadata?.role === 'teacher'
          ? profileKeys.teacher(user?.id || '')
          : profileKeys.student(user?.id || ''),
    queryFn: async (): Promise<AuthUserProfile | null> => {
      if (!user?.id) return null;
      const role = user.user_metadata?.role;
      if (!role) return null;

      if (role === USER_ROLES.ADMIN) {
        const { data: teacherRow } = await getTeacherProfile(user.id);
        if (teacherRow?.full_name?.trim()) {
          return { full_name: teacherRow.full_name, avatar_url: teacherRow.avatar_url ?? null };
        }
        const metaName =
          typeof user.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name.trim()
            : '';
        if (metaName) {
          return { full_name: metaName, avatar_url: null };
        }
        const email = user.email || '';
        const display = email ? email.split('@')[0] : 'Admin';
        return { full_name: display, avatar_url: null };
      }

      const { data, error } =
        role === 'teacher' ? await getTeacherProfile(user.id) : await getStudentProfile(user.id);

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      return data;
    },
    enabled: !!user?.id && !!user?.user_metadata?.role,
    staleTime: 5 * 60 * 1000,
  });

  const profile = profileData ?? null;
  const isAdmin = user?.user_metadata?.role === USER_ROLES.ADMIN;
  const isProfileLoading = user ? isProfileQueryLoading && !isProfileFetched : false;
  const hasProfile = isProfileFetched ? !!profileData || isAdmin : null;

  return {
    profile,
    hasProfile,
    isProfileLoading,
    refetch,
  };
}
