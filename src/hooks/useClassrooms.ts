/**
 * Classrooms Hook
 * Custom hook for fetching and managing classrooms
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getTeacherClassrooms, getStudentClassrooms } from '@/services';
import type { Classroom, ApiError } from '@/types';
import { USER_ROLES } from '@/config/constants';

interface UseClassroomsResult {
  classrooms: Classroom[];
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch classrooms based on user role
 */
export const useClassrooms = (role: 'teacher' | 'student'): UseClassroomsResult => {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchClassrooms = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } =
      role === USER_ROLES.TEACHER
        ? await getTeacherClassrooms(user.id)
        : await getStudentClassrooms(user.id);

    if (fetchError) {
      setError(fetchError);
    } else {
      setClassrooms(data || []);
    }

    setLoading(false);
  }, [user?.id, role]);

  useEffect(() => {
    fetchClassrooms();
  }, [fetchClassrooms]);

  return {
    classrooms,
    loading,
    error,
    refetch: fetchClassrooms,
  };
};
