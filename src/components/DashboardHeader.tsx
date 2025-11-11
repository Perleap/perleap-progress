import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Bell, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getUnreadNotifications, markAsRead, markAllAsRead } from '@/lib/notificationService';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  userType: 'teacher' | 'student';
  showBackButton?: boolean;
  onBackClick?: () => void;
}

interface Profile {
  full_name: string;
  avatar_url: string | null;
}

export function DashboardHeader({
  title,
  subtitle,
  userType,
  showBackButton = false,
  onBackClick,
}: DashboardHeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile>({ full_name: '', avatar_url: null });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
      fetchNotifications();
    }
  }, [user?.id]);

  const fetchProfile = async () => {
    const table = userType === 'teacher' ? 'teacher_profiles' : 'student_profiles';
    const { data } = await supabase
      .from(table)
      .select('full_name, avatar_url')
      .eq('user_id', user?.id)
      .single();

    if (data) {
      setProfile(data);
    }
  };

  const fetchNotifications = async () => {
    if (user?.id) {
      const notifs = await getUnreadNotifications(user.id);
      setNotifications(notifs);
      setUnreadCount(notifs.length);
    }
  };

  const getInitials = () => {
    if (!profile.full_name) return 'U';
    return profile.full_name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleNotificationClick = async (notification: Notification) => {
    await markAsRead(notification.id);
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setNotificationDropdownOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (user?.id) {
      await markAllAsRead(user.id);
      setNotifications([]);
      setUnreadCount(0);
      toast.success(t('common.notificationsRead'));
    }
  };

  return (
    <header className="border-b">
      <div className="container flex h-14 md:h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onBackClick || (() => navigate(-1))}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg md:text-2xl font-bold truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs md:text-sm text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <LanguageSwitcher />

          {/* Notifications Dropdown */}
          <DropdownMenu open={notificationDropdownOpen} onOpenChange={setNotificationDropdownOpen}>
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
                  <h3 className="font-semibold">{t('common.notifications')}</h3>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleMarkAllAsRead}
                    >
                      {t('common.markAllRead')}
                    </Button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    {t('common.noNotifications')}
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

          {/* Sign Out Button */}
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>

          {/* Profile Avatar */}
          <Button
            variant="ghost"
            size="sm"
            className="relative h-10 w-10 rounded-full p-0"
            onClick={() => navigate(`/${userType}/settings`)}
          >
            <Avatar className="h-10 w-10 cursor-pointer">
              {profile.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
              )}
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
          </Button>
        </div>
      </div>
    </header>
  );
}
