import { useState } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Settings, Moon, Sun, LogOut, Languages } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, type To } from 'react-router-dom';
import { useNavigateBack } from '@/hooks/useNavigateBack';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/contexts/LanguageContext';
import { NotificationDropdown } from './common/NotificationDropdown';
import { TeacherAssistantTrigger } from '@/components/ai/TeacherAssistant';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  userType: 'teacher' | 'student';
  showBackButton?: boolean;
  onBackClick?: () => void;
  /** When the default back handler runs and history cannot pop (e.g. direct load). */
  backFallbackTo?: To;
}

export function DashboardHeader({
  title,
  subtitle,
  userType,
  showBackButton = false,
  onBackClick,
  backFallbackTo,
}: DashboardHeaderProps) {
  const { user, signOut, profile: authProfile } = useAuth();
  const navigate = useNavigate();
  const navigateBackDefault = useNavigateBack(backFallbackTo ?? `/${userType}/dashboard`);
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { language = 'en', setLanguage, isRTL } = useLanguage();
  const [logoutOpen, setLogoutOpen] = useState(false);

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

  const confirmLogout = async () => {
    setLogoutOpen(false);
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
              onClick={onBackClick || navigateBackDefault}
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
          {userType === 'teacher' && <TeacherAssistantTrigger />}
          {user?.id && <NotificationDropdown userId={user.id} />}

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
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(`/${userType}/settings`)}>
                <Settings className="me-2 h-4 w-4" />
                <span>{t('settings.title')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? (
                  <Sun className="me-2 h-4 w-4" />
                ) : (
                  <Moon className="me-2 h-4 w-4" />
                )}
                <span>{theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage(language === 'en' ? 'he' : 'en')}>
                <Languages className="me-2 h-4 w-4" />
                <span>{language === 'en' ? 'עברית' : 'English'}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLogoutOpen(true)} className="text-destructive focus:text-destructive">
                <LogOut className="me-2 h-4 w-4" />
                <span>{t('common.logout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'} className="rounded-xl">
          <AlertDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
            <AlertDialogTitle>{t('nav.logoutConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('nav.logoutConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRTL ? 'flex-row-reverse sm:space-x-reverse' : ''}>
            <AlertDialogCancel className="mt-0">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmLogout();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('nav.logout')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
