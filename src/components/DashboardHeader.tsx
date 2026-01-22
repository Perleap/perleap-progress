import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Settings, Moon, Sun, LogOut, Languages } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/contexts/LanguageContext';
import { NotificationDropdown } from './common/NotificationDropdown';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  userType: 'teacher' | 'student';
  showBackButton?: boolean;
  onBackClick?: () => void;
}

export function DashboardHeader({
  title,
  subtitle,
  userType,
  showBackButton = false,
  onBackClick,
}: DashboardHeaderProps) {
  const { user, signOut, profile: authProfile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { language = 'en', setLanguage } = useLanguage();
  
  // Use auth profile if available, otherwise fall back to empty state
  const profile = authProfile || { full_name: '', avatar_url: null };

  const getHeaderInitials = () => {
    if (!profile.full_name) return 'U';
    return profile.full_name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="border-b bg-background/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container flex h-14 md:h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {showBackButton && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
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
                className="h-4 w-4 rtl:rotate-180"
              >
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
              {t('common.back')}
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
          {/* Notifications Dropdown - Refactored to use shared component with React Query */}
          {user?.id && <NotificationDropdown userId={user.id} />}

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 overflow-hidden border-2 border-primary/10 hover:border-primary/20 transition-colors">
                <Avatar className="h-full w-full">
                  {profile.avatar_url && (
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name} className="object-cover" />
                  )}
                  <AvatarFallback className="bg-primary/5 text-primary font-medium">{getHeaderInitials()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{profile.full_name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(`/${userType}/settings`)}>
                <Settings className="me-2 h-4 w-4" />
                <span>{t('settings.title')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? (
                  <Sun className="me-2 h-4 w-4" />
                ) : (
                  <Moon className="me-2 h-4 w-4" />
                )}
                <span>{theme === "dark" ? t('common.lightMode') : t('common.darkMode')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage(language === 'en' ? 'he' : 'en')}>
                <Languages className="me-2 h-4 w-4" />
                <span>{language === 'en' ? 'עברית' : 'English'}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="me-2 h-4 w-4" />
                <span>{t('common.logout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
