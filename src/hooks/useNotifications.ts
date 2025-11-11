import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Notification } from '@/types/notifications';
import { getUnreadNotifications, markAsRead, markAllAsRead } from '@/lib/notificationService';

/**
 * Custom hook for managing user notifications
 * Provides notification state and actions for notification management
 *
 * @param userId - The ID of the user to fetch notifications for
 * @returns Notification state and management functions
 */
export const useNotifications = (userId: string | undefined) => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const notifs = await getUnreadNotifications(userId);
      setNotifications(notifs);
      setUnreadCount(notifs.length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await markAsRead(notificationId);
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Error marking notification as read:', error);
        toast.error(t('notifications.errors.markingRead'));
      }
    },
    [t]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      await markAllAsRead(userId);
      setNotifications([]);
      setUnreadCount(0);
      toast.success(t('notifications.success.markedAllRead'));
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error(t('notifications.errors.markingRead'));
    }
  }, [userId, t]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    handleMarkAsRead,
    handleMarkAllAsRead,
  };
};
