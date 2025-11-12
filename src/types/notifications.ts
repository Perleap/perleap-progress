/**
 * Notification type definitions for the application
 */

export type NotificationType =
  | 'assignment_created'
  | 'assignment_graded'
  | 'submission_received'
  | 'student_enrolled'
  | 'enrolled_in_classroom'
  | 'wellbeing_alert'
  | 'feedback_received'
  | 'student_completed_activity'
  | 'student_alert_critical'
  | 'student_alert_moderate'
  | 'student_alert_low'
  | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  metadata?: NotificationMetadata | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationMetadata {
  classroom_id?: string;
  assignment_id?: string;
  submission_id?: string;
  student_id?: string;
  student_name?: string;
  classroom_name?: string;
  assignment_title?: string;
  grade?: number;
  [key: string]: unknown;
}

export interface NotificationSettings {
  submission_notifications: boolean;
  student_messages: boolean;
  classroom_updates: boolean;
  email_notifications: boolean;
}

export interface NotificationInsert {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  metadata?: NotificationMetadata;
  is_read: boolean;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: NotificationMetadata;
}
