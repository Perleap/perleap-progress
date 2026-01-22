/**
 * Notification Query Hooks
 * React Query hooks for notification operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUnreadNotifications, markAsRead, markAllAsRead, getUnreadCount } from '@/lib/notificationService';

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: (userId: string) => [...notificationKeys.all, 'unread', userId] as const,
  count: (userId: string) => [...notificationKeys.all, 'count', userId] as const,
};

/**
 * Hook to fetch unread notifications for a user
 */
export const useNotifications = (userId: string | undefined) => {
  return useQuery({
    queryKey: notificationKeys.unread(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('Missing user ID');
      return await getUnreadNotifications(userId);
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
};

/**
 * Hook to fetch unread notification count
 */
export const useUnreadCount = (userId: string | undefined) => {
  return useQuery({
    queryKey: notificationKeys.count(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('Missing user ID');
      return await getUnreadCount(userId);
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
};

/**
 * Hook to mark a notification as read
 */
export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      return await markAsRead(notificationId);
    },
    onSuccess: (_, notificationId) => {
      // Invalidate both count and list
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
};

/**
 * Hook to mark all notifications as read
 */
export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      return await markAllAsRead(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
};
