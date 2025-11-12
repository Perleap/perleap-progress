import { useState, useEffect } from 'react';
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
import type { Notification } from '@/types/notifications';
import { getUnreadNotifications, markAsRead, markAllAsRead } from '@/lib/notificationService';

interface NotificationDropdownProps {
  userId: string;
}

export const NotificationDropdown = ({ userId }: NotificationDropdownProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchNotifications();
    }
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      const notifs = await getUnreadNotifications(userId);
      setNotifications(notifs);
      setUnreadCount(notifs.length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    try {
      await markAsRead(notification.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
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

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead(userId);
      setNotifications([]);
      setUnreadCount(0);
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
              >
                {t('notifications.markAllRead')}
              </Button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {t('notifications.empty')}
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-3 rounded-lg bg-accent/50 text-sm hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <p className="font-medium">{notification.title}</p>
                  <p className="text-xs text-muted-foreground">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(notification.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
