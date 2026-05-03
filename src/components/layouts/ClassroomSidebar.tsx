import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNavigateBack } from '@/hooks/useNavigateBack';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronDown,
  Moon,
  Sun,
  ArrowLeft,
  Globe,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Home,
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
import { USER_ROLES } from '@/config/constants';

import { ClassroomSection } from '@/config/classroomSections';
import { MonitoringInlineNav } from '@/pages/admin/monitoring/MonitoringInlineNav';
import { AdminAiPromptsSidebarLink } from '@/pages/admin/AdminAiPromptsSidebarLink';
import { cn } from '@/lib/utils';

interface ClassroomSidebarProps {
  classroomName?: string;
  classroomSubject?: string;
  activeSection: string;
  onSectionChange: (section: string) => void;
  sections: ClassroomSection[];
  hideGlobalNav?: boolean;
}

export function ClassroomSidebar({
  classroomName,
  classroomSubject,
  activeSection,
  onSectionChange,
  sections,
  hideGlobalNav = false,
}: ClassroomSidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isRTL, language = 'en', setLanguage } = useLanguage();
  const location = useLocation();
  const { toggleSidebar, state } = useSidebar();

  const [logoutOpen, setLogoutOpen] = React.useState(false);

  const isTeacher =
    user?.user_metadata?.role === 'teacher' || user?.user_metadata?.role === 'admin';
  const isAppAdmin = user?.user_metadata?.role === USER_ROLES.ADMIN;
  const basePath = isTeacher ? '/teacher' : '/student';

  const navigateBackOrDashboard = useNavigateBack(`${basePath}/dashboard`);

  const isDashboardActive = location.pathname === `${basePath}/dashboard`;
  const isPlannerActive =
    location.pathname === '/teacher/planner' || location.pathname.startsWith('/teacher/planner/');

  const collapseChevronIcon =
    state === 'collapsed'
      ? isRTL
        ? ChevronLeft
        : ChevronRight
      : isRTL
        ? ChevronRight
        : ChevronLeft;

  const confirmLogout = async () => {
    setLogoutOpen(false);
    await signOut();
    navigate('/');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

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

  /** Second row: real subject, or "Back to dashboard" when unset — omit when subject duplicates the course name */
  const sidebarHeaderSecondLine = React.useMemo(() => {
    const nameTrim = (classroomName ?? '').trim();
    const subjectTrim = (classroomSubject ?? '').trim();
    if (subjectTrim && subjectTrim !== nameTrim) return subjectTrim;
    if (!subjectTrim) return t('nav.backToDashboard');
    return null;
  }, [classroomName, classroomSubject, t]);

  return (
    <Sidebar collapsible="icon" side={isRTL ? 'right' : 'left'}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div
              className={cn(
                'flex w-full min-w-0 items-center gap-1 rounded-lg p-1',
                state === 'expanded' && isRTL && 'flex-row-reverse',
                state === 'collapsed' && 'flex-col items-center justify-center gap-0.5 py-1.5',
              )}
            >
              <SidebarMenuButton
                type="button"
                size="sm"
                className="h-9 w-9 shrink-0 justify-center !gap-0 !p-0"
                tooltip={t('common.back')}
                onClick={(e) => {
                  e.preventDefault();
                  navigateBackOrDashboard();
                }}
              >
                <ArrowLeft className="size-4 rtl:rotate-180" />
              </SidebarMenuButton>
              <SidebarMenuButton
                type="button"
                size="sm"
                className="h-9 w-9 shrink-0 justify-center !gap-0 !p-0"
                tooltip={t('nav.home')}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`${basePath}/dashboard`);
                }}
              >
                <Home className="size-4" />
              </SidebarMenuButton>
              {state === 'expanded' ? (
                <div
                  className={cn(
                    'grid min-w-0 flex-1 text-sm leading-tight',
                    isRTL ? 'text-right' : 'text-left',
                    sidebarHeaderSecondLine === null ? 'grid-rows-1' : '',
                  )}
                >
                  <span className="truncate font-semibold">{classroomName || t('nav.classroom')}</span>
                  {sidebarHeaderSecondLine !== null && (
                    <span className="truncate text-xs text-muted-foreground">{sidebarHeaderSecondLine}</span>
                  )}
                </div>
              ) : null}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {!hideGlobalNav && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="px-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {t('nav.navigation')}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip={t('nav.dashboard')}
                      onClick={() => navigate(`${basePath}/dashboard`)}
                      isActive={isDashboardActive}
                      className={`min-h-[48px] transition-all duration-200 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg ${isDashboardActive ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
                    >
                      <LayoutDashboard className="size-5 group-data-[collapsible=icon]:size-5" />
                      <span className="font-medium text-base group-data-[collapsible=icon]:hidden">{t('nav.dashboard')}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {isTeacher && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        tooltip={t('nav.planner')}
                        onClick={() => navigate('/teacher/planner')}
                        isActive={isPlannerActive}
                        className={`min-h-[48px] transition-all duration-200 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg ${isPlannerActive ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
                      >
                        <Calendar className="size-5 group-data-[collapsible=icon]:size-5" />
                        <span className="font-medium text-base group-data-[collapsible=icon]:hidden">{t('nav.planner')}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
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
          </>
        )}
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {t('nav.classroomSections')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {sections.map((section) => (
                <SidebarMenuItem key={section.id}>
                  <SidebarMenuButton
                    isActive={activeSection === section.id}
                    tooltip={section.title}
                    onClick={() => {
                      if (section.disabled) return;
                      onSectionChange(section.id);
                    }}
                    aria-disabled={section.disabled ? true : undefined}
                    className={`min-h-[48px] transition-all duration-200 group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg ${
                      section.disabled
                        ? 'cursor-not-allowed opacity-55 pointer-events-none'
                        : 'cursor-pointer'
                    }`}
                  >
                    <section.icon className="size-5 group-data-[collapsible=icon]:size-5" />
                    <span className="font-medium text-base group-data-[collapsible=icon]:hidden">{section.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
