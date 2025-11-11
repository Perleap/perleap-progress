/**
 * Assignments Hook
 * Custom hook for fetching and managing assignments
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getClassroomAssignments, getStudentAssignments } from '@/services';
import type { Assignment, AssignmentWithClassroom, ApiError } from '@/types';

interface UseAssignmentsResult {
  assignments: Assignment[] | AssignmentWithClassroom[];
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch classroom assignments (teacher view)
 */
export const useClassroomAssignments = (classroomId: string): UseAssignmentsResult => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchAssignments = useCallback(async () => {
    if (!classroomId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await getClassroomAssignments(classroomId);

    if (fetchError) {
      setError(fetchError);
    } else {
      setAssignments(data || []);
    }

    setLoading(false);
  }, [classroomId]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return {
    assignments,
    loading,
    error,
    refetch: fetchAssignments,
  };
};

/**
 * Hook to fetch student assignments
 */
export const useStudentAssignments = (): UseAssignmentsResult => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentWithClassroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchAssignments = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await getStudentAssignments(user.id);

    if (fetchError) {
      setError(fetchError);
    } else {
      setAssignments(data || []);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return {
    assignments,
    loading,
    error,
    refetch: fetchAssignments,
  };
};
