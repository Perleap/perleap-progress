/**
 * Profile Hook
 * Custom hook for fetching user profile data
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getTeacherProfile, getStudentProfile, getInitials } from '@/services';
import type { TeacherProfile, StudentProfile, ApiError } from '@/types';
import { USER_ROLES } from '@/config/constants';

interface UseProfileResult {
  profile: TeacherProfile | StudentProfile | null;
  loading: boolean;
  error: ApiError | null;
  initials: string;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage user profile
 */
export const useProfile = (role: 'teacher' | 'student'): UseProfileResult => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<TeacherProfile | StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } =
      role === USER_ROLES.TEACHER
        ? await getTeacherProfile(user.id)
        : await getStudentProfile(user.id);

    if (fetchError) {
      setError(fetchError);
    } else {
      setProfile(data);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, [user?.id, role]);

  const initials = getInitials(profile?.first_name, profile?.last_name);

  return {
    profile,
    loading,
    error,
    initials,
    refetch: fetchProfile,
  };
};
