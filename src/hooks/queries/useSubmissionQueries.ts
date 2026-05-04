/**
 * Submission Query Hooks
 * React Query hooks for submission operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { createNotification } from '@/lib/notificationService';
import i18n from 'i18next';
import {
  getStudentSubmissionContext,
  getSubmissionById,
  getFullSubmissionDetails,
  getAssignmentConversationMessages,
  getAssignmentChatSentenceFlags,
  getClassroomSubmissions,
  getEnrichedClassroomSubmissions,
  getSubmissionFeedback,
  completeSubmission,
  sendChatMessage,
  generateFeedback,
  listSubmissionTeacherPrivateNoteEntries,
  createSubmissionTeacherPrivateNoteEntry,
  teacherResetStudentAssignmentProgress,
} from '@/services/submissionService';
import type { ChatRequest, FeedbackRequest } from '@/types';
import { assignmentFlowCompleteKeys, assignmentSubmittedFlagsKeys } from './useModuleFlowQueries';
import { notificationKeys } from './useNotificationQueries';
import { invalidateStudentTimelineCurriculaQueries } from '@/lib/studentTimelineCurriculaKeys';

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
  conversation: (submissionId: string) =>
    [...submissionKeys.all, 'conversation', submissionId] as const,
  chatSentenceFlags: (submissionId: string) =>
    [...submissionKeys.all, 'chat-sentence-flags', submissionId] as const,
  teacherPrivateNoteEntries: (submissionId: string) =>
    [...submissionKeys.all, 'teacher-private-note-entries', submissionId] as const,
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
      const { data, error } = await getStudentSubmissionContext(assignmentId, user.id);
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
      queryClient.invalidateQueries({ queryKey: assignmentFlowCompleteKeys.all });
      queryClient.invalidateQueries({ queryKey: assignmentSubmittedFlagsKeys.all });
      invalidateStudentTimelineCurriculaQueries(queryClient);
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

/**
 * Live chat messages for a submission (teacher view; requires RLS policy).
 */
export const useTeacherConversationMessages = (
  submissionId: string | undefined,
  enabled: boolean
) => {
  return useQuery({
    queryKey: submissionKeys.conversation(submissionId || ''),
    queryFn: async () => {
      if (!submissionId) throw new Error('Missing submission ID');
      const { data, error } = await getAssignmentConversationMessages(submissionId);
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId && enabled,
    staleTime: 30 * 1000,
  });
};

/**
 * Student-reported assistant sentence flags for a submission (teacher/student RLS).
 */
export const useTeacherChatSentenceFlags = (
  submissionId: string | undefined,
  enabled: boolean
) => {
  return useQuery({
    queryKey: submissionKeys.chatSentenceFlags(submissionId || ''),
    queryFn: async () => {
      if (!submissionId) throw new Error('Missing submission ID');
      const { data, error } = await getAssignmentChatSentenceFlags(submissionId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!submissionId && enabled,
    staleTime: 30 * 1000,
  });
};

export const useSubmissionTeacherPrivateNoteEntries = (submissionId: string | undefined) => {
  return useQuery({
    queryKey: submissionKeys.teacherPrivateNoteEntries(submissionId || ''),
    queryFn: async () => {
      if (!submissionId) throw new Error('Missing submission ID');
      const { data, error } = await listSubmissionTeacherPrivateNoteEntries(submissionId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!submissionId,
    staleTime: 30 * 1000,
  });
};

export const useCreateSubmissionTeacherPrivateNoteEntry = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { submissionId: string; body: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { success, error } = await createSubmissionTeacherPrivateNoteEntry({
        submissionId: params.submissionId,
        body: params.body,
        userId: user.id,
      });
      if (error || !success) throw error ?? new Error('save failed');
    },
    onSuccess: (_, params) => {
      void queryClient.invalidateQueries({
        queryKey: submissionKeys.teacherPrivateNoteEntries(params.submissionId),
      });
    },
  });
};

export type TeacherResetStudentProgressInput = {
  submissionId: string;
  notify: {
    studentId: string;
    assignmentId: string;
    assignmentTitle: string;
    classroomId?: string;
    teacherId?: string | null;
  };
  notificationCopy: { title: string; message: string };
};

export const useTeacherResetStudentAssignmentProgress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: TeacherResetStudentProgressInput) => {
      const { data: newSubmissionId, error } = await teacherResetStudentAssignmentProgress(
        vars.submissionId,
      );
      if (error) throw error;
      if (!newSubmissionId) throw new Error('No submission returned');

      try {
        await createNotification(
          vars.notify.studentId,
          'assignment_new_attempt',
          vars.notificationCopy.title,
          vars.notificationCopy.message,
          `/student/assignment/${vars.notify.assignmentId}`,
          {
            assignment_id: vars.notify.assignmentId,
            submission_id: newSubmissionId,
            classroom_id: vars.notify.classroomId,
            assignment_title: vars.notify.assignmentTitle,
          },
          vars.notify.teacherId ?? undefined,
        );
      } catch (notifErr) {
        console.error('Failed to notify student of new attempt', notifErr);
        toast.warning(i18n.t('notifications.newAttempt.notifyFailed'));
      }

      return newSubmissionId;
    },
    onSuccess: (newSubmissionId) => {
      queryClient.invalidateQueries({ queryKey: submissionKeys.all });
      queryClient.invalidateQueries({ queryKey: assignmentFlowCompleteKeys.all });
      queryClient.invalidateQueries({ queryKey: assignmentSubmittedFlagsKeys.all });
      invalidateStudentTimelineCurriculaQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      if (newSubmissionId) {
        queryClient.invalidateQueries({
          queryKey: submissionKeys.detail(newSubmissionId),
        });
      }
    },
  });
};








