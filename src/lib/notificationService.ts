import { supabase } from "@/integrations/supabase/client";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  metadata: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export type NotificationType =
  // Student notifications
  | 'assignment_created'
  | 'feedback_received'
  | 'deadline_reminder'
  | 'enrolled_in_classroom'
  // Teacher notifications
  | 'student_enrolled'
  | 'submission_received'
  | 'student_completed_activity';

/**
 * Create a new notification for a user
 * Designed to work with both direct calls and future real-time triggers
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string,
  metadata?: Record<string, any>
) {
  try {
    const { data, error } = await supabase
      .from('notifications' as any)
      .insert({
        user_id: userId,
        type,
        title,
        message,
        link: link || null,
        metadata: metadata || {},
        is_read: false,
      })
      .select()
      .single();

    if (error) throw error;

    return data as unknown as Notification;
  } catch (error) {
    throw error;
  }
}

/**
 * Create multiple notifications at once (batch operation)
 * Useful for notifying all students in a classroom
 */
export async function createBulkNotifications(
  notifications: Array<{
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, any>;
  }>
) {
  try {
    const { data, error } = await supabase
      .from('notifications' as any)
      .insert(
        notifications.map((n) => ({
          user_id: n.userId,
          type: n.type,
          title: n.title,
          message: n.message,
          link: n.link || null,
          metadata: n.metadata || {},
          is_read: false,
        }))
      )
      .select();

    if (error) throw error;

    return data as unknown as Notification[];
  } catch (error) {
    throw error;
  }
}

/**
 * Get unread notifications for a user
 * Returns data structure compatible with future real-time subscriptions
 */
export async function getUnreadNotifications(userId: string) {
  try {
    const { data, error } = await supabase
      .from('notifications' as any)
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data as unknown as Notification[];
  } catch (error) {
    return [];
  }
}

/**
 * Get all notifications for a user (with optional limit)
 */
export async function getAllNotifications(userId: string, limit: number = 50) {
  try {
    const { data, error } = await supabase
      .from('notifications' as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data as unknown as Notification[];
  } catch (error) {
    return [];
  }
}

/**
 * Get count of unread notifications for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications' as any)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) return 0;

    return count || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string) {
  try {
    const { error } = await supabase
      .from('notifications' as any)
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
  try {
    const { error } = await supabase
      .from('notifications' as any)
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Delete old read notifications (cleanup utility)
 * Can be called periodically to keep the table manageable
 */
export async function deleteOldNotifications(userId: string, daysOld: number = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { error } = await supabase
      .from('notifications' as any)
      .delete()
      .eq('user_id', userId)
      .eq('is_read', true)
      .lt('created_at', cutoffDate.toISOString());

    if (error) throw error;

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Future: Subscribe to real-time notification updates
 * This function structure is ready for when real-time is implemented
 * 
 * Usage example (future):
 * const unsubscribe = subscribeToNotifications(userId, (notification) => {
 *   // Handle new notification
 * });
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void
) {
  // Placeholder for future real-time implementation
  // Will use supabase.channel().on('postgres_changes', ...).subscribe()
  
  return () => {
    // Cleanup function for future implementation
  };
}

