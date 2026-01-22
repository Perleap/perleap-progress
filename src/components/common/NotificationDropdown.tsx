import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { NotificationWithProfile } from '@/types/notifications';
import { useNotificationList, useMarkAsRead, useMarkAllAsRead } from '@/hooks/queries';

interface NotificationDropdownProps {
  userId: string;
}

export const NotificationDropdown = ({ userId }: NotificationDropdownProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Use React Query for notifications
  const { data: notifications = [], isLoading } = useNotificationList(userId);
  
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();

  const unreadCount = notifications.length;

  const handleNotificationClick = async (notification: NotificationWithProfile) => {
    try {
      await markAsReadMutation.mutateAsync(notification.id);
      setDropdownOpen(false);
      
      // Navigate if link exists and is a valid string
      if (notification.link && typeof notification.link === 'string' && notification.link.trim() !== '') {
        console.log('Navigating to:', notification.link);
        navigate(notification.link);
      } else {
        console.warn('Notification clicked but no valid link to navigate to:', {
          id: notification.id,
          type: notification.type,
          link: notification.link,
        });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getInitials = (name: string, type: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    
    // Fallback based on notification type
    switch (type) {
      case 'feedback_received':
      case 'assignment_created':
      case 'assignment_graded':
        return 'T'; // Teacher
      case 'student_enrolled':
      case 'student_completed_activity':
      case 'wellbeing_alert':
        return 'S'; // Student
      case 'system':
        return 'SYS';
      default:
        return '??';
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync(userId);
      toast.success(t('notifications.success.markedAllRead'));
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error(t('notifications.errors.markingRead'));
    }
  };

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-8 w-8 rounded-full">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="p-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">{t('notifications.title')}</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleMarkAllAsRead}
                disabled={markAllAsReadMutation.isPending}
              >
                {t('notifications.markAllRead')}
              </Button>
            )}
          </div>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {t('common.loading')}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {t('notifications.empty')}
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-accent/50 text-sm hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <Avatar className="h-10 w-10 border border-border/50 shrink-0">
                    <AvatarImage src={notification.actor_profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px] bg-muted uppercase">
                      {getInitials(notification.actor_profile?.full_name || '', notification.type)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="font-medium leading-none">{notification.title}</p>
                    <p className="text-xs text-muted-foreground leading-normal">{notification.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(notification.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

