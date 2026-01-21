import * as React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  User2,
  Moon,
  Sun,
  Users,
  FileText,
  Info,
  ArrowLeft,
  Globe,
  Calendar,
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
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/contexts/LanguageContext';

import { ClassroomSection } from '@/config/classroomSections';

interface ClassroomSidebarProps {
  classroomName?: string;
  classroomSubject?: string;
  activeSection: string;
  onSectionChange: (section: string) => void;
  sections: ClassroomSection[];
}

export function ClassroomSidebar({
  classroomName,
  classroomSubject,
  activeSection,
  onSectionChange,
  sections,
}: ClassroomSidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isRTL, language = 'en', setLanguage } = useLanguage();
  const location = useLocation();

  const isTeacher = user?.user_metadata?.role === 'teacher';
  const basePath = isTeacher ? '/teacher' : '/student';

  const isDashboardActive = location.pathname === `${basePath}/dashboard`;
  const isPlannerActive = location.pathname === '/teacher/planner';
  const isSettingsActive = location.pathname.startsWith(`${basePath}/settings`);

  const handleSignOut = async () => {
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

  return (
    <Sidebar collapsible="icon" side={isRTL ? "right" : "left"}>
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              onClick={() => navigate(`${basePath}/dashboard`)}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted">
                <ArrowLeft className="size-4 rtl:rotate-180" />
              </div>
              <div className={`grid flex-1 ${isRTL ? 'text-right' : 'text-left'} text-sm leading-tight`}>
                <span className="truncate font-semibold">{classroomName || t('nav.classroom')}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {classroomSubject || t('nav.backToDashboard')}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {/* Main Navigation */}
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
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={t('nav.settings')}
                  onClick={() => navigate(`${basePath}/settings`)}
                  isActive={isSettingsActive}
                  className={`min-h-[48px] transition-all duration-200 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg ${isSettingsActive ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
                >
                  <Settings className="size-5 group-data-[collapsible=icon]:size-5" />
                  <span className="font-medium text-base group-data-[collapsible=icon]:hidden">{t('nav.settings')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Classroom Sections */}
        <SidebarSeparator className="my-2" />
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
                    onClick={() => onSectionChange(section.id)}
                    className="cursor-pointer min-h-[48px] transition-all duration-200 group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg"
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

      <SidebarFooter className="border-t border-sidebar-border px-2 py-4">
        <SidebarMenu className="space-y-1">
          {/* Theme Toggle */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              className="min-h-[40px] group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg"
            >
              {theme === 'dark' ? (
                <Sun className="size-5 group-data-[collapsible=icon]:size-5" />
              ) : (
                <Moon className="size-5 group-data-[collapsible=icon]:size-5" />
              )}
              <span className="font-medium text-base group-data-[collapsible=icon]:hidden">
                {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Language - Dropdown */}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  tooltip="Language"
                  className="min-h-[40px] group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg cursor-pointer hover:bg-sidebar-accent/50 transition-colors"
                >
                  <Globe className="size-5 group-data-[collapsible=icon]:size-5 opacity-70" />
                  <span className={`font-semibold text-sm group-data-[collapsible=icon]:hidden flex-1 ${isRTL ? 'text-right mr-1' : 'text-left ml-1'}`}>
                    {language === 'en' ? 'English' : 'עברית'}
                  </span>
                  <ChevronDown className={`${isRTL ? 'mr-auto' : 'ml-auto'} size-4 opacity-50 group-data-[collapsible=icon]:hidden`} />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="end"
                dir={isRTL ? 'rtl' : 'ltr'}
                className="w-[--radix-dropdown-menu-trigger-width] min-w-[160px] rounded-xl p-1 shadow-lg border border-border/50"
              >
                <DropdownMenuItem
                  onClick={() => setLanguage('en')}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    language === 'en' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-accent'
                  }`}
                >
                  <span className="text-lg leading-none">🇺🇸</span>
                  <span>English</span>
                  {language === 'en' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLanguage('he')}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    language === 'he' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-accent'
                  }`}
                >
                  <span className="text-lg leading-none">🇮🇱</span>
                  <span>עברית</span>
                  {language === 'he' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>

          <SidebarSeparator className="my-2" />

          {/* Profile - Dropdown Menu */}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg"
                >
                  <Avatar className="h-8 w-8 rounded-lg group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || ''} />
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`grid flex-1 ${isRTL ? 'text-right' : 'text-left'} text-sm leading-tight group-data-[collapsible=icon]:hidden`}>
                    <span className="truncate font-semibold">{profile?.full_name || t('nav.user')}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {isTeacher ? t('nav.teacher') : t('nav.student')}
                    </span>
                  </div>
                  <ChevronDown className={`${isRTL ? 'mr-auto' : 'ml-auto'} size-4 group-data-[collapsible=icon]:hidden`} />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align={isRTL ? "start" : "end"}
                sideOffset={8}
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                  <LogOut className={`${isRTL ? 'ml-2' : 'mr-2'} size-4`} />
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

// Pre-defined sections removed - now in @/config/classroomSections


