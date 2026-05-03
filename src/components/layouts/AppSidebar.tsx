import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronDown,
  User,
  Moon,
  Sun,
  Bell,
  MessageSquare,
  Calendar,
  Globe,
  Volume2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
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
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/useAuth';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/contexts/LanguageContext';
import { PerleapLogo } from '@/components/PerleapLogo';
import { cn } from '@/lib/utils';
import { isAppAdminRole } from '@/utils/role';
import { MonitoringInlineNav } from '@/pages/admin/monitoring/MonitoringInlineNav';
import { AdminAiPromptsSidebarLink } from '@/pages/admin/AdminAiPromptsSidebarLink';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language = 'en', setLanguage, isRTL } = useLanguage();
  const { toggleSidebar, state } = useSidebar();

  const [logoutOpen, setLogoutOpen] = React.useState(false);

  const isTeacher =
    user?.user_metadata?.role === 'teacher' || user?.user_metadata?.role === 'admin';
  const isAppAdmin = isAppAdminRole(user?.user_metadata?.role);
  const basePath = isTeacher ? '/teacher' : '/student';
  const isOnSettingsPage = location.pathname.includes('/settings');

  const accountItems: NavItem[] = React.useMemo(() => {
    const items: NavItem[] = [
      {
        title: t('settings.profile'),
        url: `${basePath}/settings?tab=profile`,
        icon: User,
      },
      {
        title: t('common.notifications'),
        url: `${basePath}/settings?tab=notifications`,
        icon: Bell,
      },
    ];

    if (isTeacher) {
      items.splice(1, 0, {
        title: t('settings.teachingPreferences'),
        url: '/teacher/settings?tab=questions',
        icon: MessageSquare,
      });
    } else {
      items.splice(1, 0, {
        title: t('settings.learningPreferences'),
        url: '/student/settings?tab=questions',
        icon: MessageSquare,
      });
      items.splice(2, 0, {
        title: t('settings.voicePreference'),
        url: `${basePath}/settings?tab=preferences`,
        icon: Volume2,
      });
    }

    return items;
  }, [t, basePath, isTeacher]);

  const isDashboardActive = location.pathname === `${basePath}/dashboard`;
  const isPlannerActive =
    location.pathname === '/teacher/planner' || location.pathname.startsWith('/teacher/planner/');

  const accountItemsWithActive = accountItems.map((item) => {
    const currentTab = new URLSearchParams(location.search).get('tab') || 'profile';
    const itemUrl = new URL(item.url, 'http://localhost');
    const itemPath = itemUrl.pathname;
    const itemTab = itemUrl.searchParams.get('tab');

    return {
      ...item,
      isActive: location.pathname === itemPath && currentTab === itemTab,
    };
  });

  const confirmLogout = async () => {
    setLogoutOpen(false);
    await signOut();
    navigate('/');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const collapseChevronIcon =
    state === 'collapsed'
      ? isRTL
        ? ChevronLeft
        : ChevronRight
      : isRTL
        ? ChevronRight
        : ChevronLeft;

  const userInitials = React.useMemo(() => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'U';
  }, [profile?.full_name]);

  return (
    <Sidebar collapsible="icon" side={isRTL ? 'right' : 'left'} {...props}>
      <SidebarHeader className="flex min-h-24 items-center px-4 py-2.5 sm:px-5 group-data-[collapsible=icon]:min-h-16 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2">
        <SidebarMenu>
          <SidebarMenuItem className="list-none">
            <div className="flex min-w-0 items-center gap-3 group-data-[collapsible=icon]:justify-center sm:gap-3.5">
              <PerleapLogo className="size-14 shrink-0 sm:size-16 group-data-[collapsible=icon]:size-10" />
              <span
                className={`truncate text-xl font-bold leading-none tracking-tight text-foreground sm:text-2xl group-data-[collapsible=icon]:hidden ${isRTL ? 'text-right' : 'text-left'}`}
              >
                Perleap
              </span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {t('nav.menu')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate(`${basePath}/dashboard`)}
                  isActive={isDashboardActive}
                  tooltip={t('nav.dashboard')}
                  className={`min-h-[48px] transition-all duration-200 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg ${isDashboardActive ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
                >
                  <LayoutDashboard className="size-5 group-data-[collapsible=icon]:size-5" />
                  <span className="font-medium text-base group-data-[collapsible=icon]:hidden">{t('nav.dashboard')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isTeacher ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate('/teacher/planner')}
                    isActive={isPlannerActive}
                    tooltip={t('nav.planner')}
                    className={`min-h-[48px] transition-all duration-200 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg ${isPlannerActive ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
                  >
                    <Calendar className="size-5 group-data-[collapsible=icon]:size-5" />
                    <span className="font-medium text-base group-data-[collapsible=icon]:hidden">{t('nav.planner')}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {isTeacher && isAppAdmin ? (
                  <>
                    <AdminAiPromptsSidebarLink />
                    <MonitoringInlineNav />
                  </>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="h-2 shrink-0" aria-hidden />

        {isOnSettingsPage && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t('nav.settings')}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {accountItemsWithActive.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.url)}
                      isActive={item.isActive}
                      className="cursor-pointer min-h-[40px]"
                    >
                      <item.icon className="size-4" />
                      <span className="font-normal text-sm">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="gap-3 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
                isRTL && 'flex-row-reverse',
                'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0',
              )}
            >
              <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || ''} />
                <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-start font-semibold group-data-[collapsible=icon]:hidden">
                {profile?.full_name || t('nav.user')}
              </span>
              <ChevronDown className="size-4 shrink-0 opacity-60 group-data-[collapsible=icon]:hidden" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isRTL ? 'left' : 'right'}
            align="end"
            dir={isRTL ? 'rtl' : 'ltr'}
            className="w-56 rounded-xl"
          >
            <DropdownMenuItem onClick={() => navigate(`${basePath}/settings`)} className="gap-2">
              <Settings className="size-4" />
              {t('nav.settings')}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <Globe className="size-4 opacity-70" />
                {t('nav.language')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent dir={isRTL ? 'rtl' : 'ltr'} className="rounded-xl">
                <DropdownMenuItem
                  onClick={() => setLanguage('en')}
                  className={language === 'en' ? 'bg-primary/10 font-medium' : ''}
                >
                  English
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLanguage('he')}
                  className={language === 'he' ? 'bg-primary/10 font-medium' : ''}
                >
                  עברית
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setLogoutOpen(true)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="size-4" />
              {t('nav.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div
          className={cn(
            'flex items-center justify-between gap-2 px-1',
            'group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center',
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg text-sidebar-foreground"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
          >
            {theme === 'dark' ? (
              <Sun className="size-5" />
            ) : (
              <Moon className="size-5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg text-sidebar-foreground"
            onClick={toggleSidebar}
            aria-label={t('nav.toggleSidebar')}
          >
            {React.createElement(collapseChevronIcon, { className: 'size-5' })}
          </Button>
        </div>
      </SidebarFooter>

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
    </Sidebar>
  );
}
