/**
 * Submission Query Hooks
 * React Query hooks for submission operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getOrCreateSubmission,
  getSubmissionById,
  getFullSubmissionDetails,
  getClassroomSubmissions,
  getEnrichedClassroomSubmissions,
  getSubmissionFeedback,
  completeSubmission,
  sendChatMessage,
  generateFeedback,
} from '@/services/submissionService';
import type { ChatRequest, FeedbackRequest } from '@/types';

// Query Keys
export const submissionKeys = {
  all: ['submissions'] as const,
  lists: () => [...submissionKeys.all, 'list'] as const,
  listByClassroom: (classroomId: string) => [...submissionKeys.lists(), 'classroom', classroomId] as const,
  details: () => [...submissionKeys.all, 'detail'] as const,
  detail: (id: string) => [...submissionKeys.details(), id] as const,
  forAssignment: (assignmentId: string, studentId: string) =>
    [...submissionKeys.all, 'assignment', assignmentId, studentId] as const,
  feedback: (submissionId: string) => [...submissionKeys.all, 'feedback', submissionId] as const,
};

/**
 * Hook to get or create a submission for an assignment
 */
export const useSubmission = (assignmentId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: submissionKeys.forAssignment(assignmentId || '', user?.id || ''),
    queryFn: async () => {
      if (!user || !assignmentId) throw new Error('Missing user or assignment ID');
      const { data, error } = await getOrCreateSubmission(assignmentId, user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!assignmentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to fetch a submission by ID (with details)
 */
export const useSubmissionDetails = (submissionId: string | undefined) => {
  return useQuery({
    queryKey: submissionKeys.detail(submissionId || ''),
    queryFn: async () => {
      if (!submissionId) throw new Error('Missing submission ID');
      const { data, error } = await getSubmissionById(submissionId);
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to fetch all submissions for a classroom
 */
export const useClassroomSubmissions = (classroomId: string | undefined) => {
  return useQuery({
    queryKey: submissionKeys.listByClassroom(classroomId || ''),
    queryFn: async () => {
      if (!classroomId) throw new Error('Missing classroom ID');
      const { data, error } = await getClassroomSubmissions(classroomId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!classroomId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Hook to fetch feedback for a submission
 */
export const useSubmissionFeedback = (submissionId: string | undefined) => {
  return useQuery({
    queryKey: submissionKeys.feedback(submissionId || ''),
    queryFn: async () => {
      if (!submissionId) throw new Error('Missing submission ID');
      const { data, error } = await getSubmissionFeedback(submissionId);
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId,
  });
};

/**
 * Hook to complete a submission
 */
export const useCompleteSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissionId: string) => {
      const { success, error } = await completeSubmission(submissionId);
      if (error) throw error;
      return { success, submissionId };
    },
    onSuccess: (_, submissionId) => {
      queryClient.invalidateQueries({ queryKey: submissionKeys.detail(submissionId) });
      queryClient.invalidateQueries({ queryKey: submissionKeys.lists() });
    },
  });
};

/**
 * Hook to send a chat message to the Perleap agent
 */
export const useSendChatMessage = () => {
  return useMutation({
    mutationFn: async (request: ChatRequest) => {
      const { data, error } = await sendChatMessage(request);
      if (error) throw error;
      return data;
    },
  });
};

/**
 * Hook to generate feedback for a submission
 */
export const useGenerateFeedback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: FeedbackRequest) => {
      const { data, error } = await generateFeedback(request);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, request) => {
      queryClient.invalidateQueries({
        queryKey: submissionKeys.feedback(request.submissionId),
      });
      queryClient.invalidateQueries({
        queryKey: submissionKeys.detail(request.submissionId),
      });
    },
  });
};

/**
 * Hook to fetch enriched submissions for a classroom
 */
export const useEnrichedClassroomSubmissions = (classroomId: string | undefined) => {
  return useQuery({
    queryKey: [...submissionKeys.listByClassroom(classroomId || ''), 'enriched'],
    queryFn: async () => {
      if (!classroomId) throw new Error('Missing classroom ID');
      const { data, error } = await getEnrichedClassroomSubmissions(classroomId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!classroomId,
    staleTime: 2 * 60 * 1000,
  });
};

/**
 * Hook to fetch full enriched submission details for teacher view
 */
export const useFullSubmissionDetails = (submissionId: string | undefined) => {
  return useQuery({
    queryKey: [...submissionKeys.detail(submissionId || ''), 'full'],
    queryFn: async () => {
      if (!submissionId) throw new Error('Missing submission ID');
      const { data, error } = await getFullSubmissionDetails(submissionId);
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId,
    staleTime: 2 * 60 * 1000,
  });
};








