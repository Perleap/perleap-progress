/**
 * Profile Hook
 * Custom hook for fetching user profile data
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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

  // Use refs to track fetch status and prevent duplicates/re-fetches
  const hasFetchedRef = useRef(false);
  const lastUserIdRef = useRef<string | undefined>(undefined);

  const fetchProfile = useCallback(async () => {
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
  }, [user, role]);

  useEffect(() => {
    // Reset if user ID changed
    if (user?.id !== lastUserIdRef.current) {
      hasFetchedRef.current = false;
      lastUserIdRef.current = user?.id;
    }

    // Only fetch if we haven't fetched yet for this user
    if (!hasFetchedRef.current && user?.id) {
      fetchProfile();
      hasFetchedRef.current = true;
    }
  }, [user?.id, role, fetchProfile]);

  const initials = getInitials(profile?.first_name, profile?.last_name);

  const handleRefetch = async () => {
    hasFetchedRef.current = false;
    await fetchProfile();
    hasFetchedRef.current = true;
  };

  return {
    profile,
    loading,
    error,
    initials,
    refetch: handleRefetch,
  };
};
