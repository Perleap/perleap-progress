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
  ChevronUp,
  User2,
  Moon,
  Sun,
  Users,
  FileText,
  Info,
  ArrowLeft,
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
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

interface ClassroomSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

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
  const { profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isRTL } = useLanguage();

  const isTeacher = profile?.role === 'teacher';
  const basePath = isTeacher ? '/teacher' : '/student';

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
                <ArrowLeft className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{classroomName || t('nav.classroom')}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {classroomSubject || t('nav.backToDashboard')}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.classroomSections')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map((section) => (
                <SidebarMenuItem key={section.id}>
                  <SidebarMenuButton
                    isActive={activeSection === section.id}
                    tooltip={section.title}
                    onClick={() => onSectionChange(section.id)}
                    className="group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg"
                  >
                    <section.icon className="size-4 group-data-[collapsible=icon]:size-5" />
                    <span>{section.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.navigation')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={t('nav.dashboard')}
                  onClick={() => navigate(`${basePath}/dashboard`)}
                  className="group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg"
                >
                  <LayoutDashboard className="size-4 group-data-[collapsible=icon]:size-5" />
                  <span>{t('nav.dashboard')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={t('nav.settings')}
                  onClick={() => navigate(`${basePath}/settings`)}
                  className="group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg"
                >
                  <Settings className="size-4 group-data-[collapsible=icon]:size-5" />
                  <span>{t('nav.settings')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || ''} />
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{profile?.full_name || t('nav.user')}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {isTeacher ? t('nav.teacher') : t('nav.student')}
                    </span>
                  </div>
                  <ChevronUp className={`${isRTL ? 'mr-auto' : 'ml-auto'} size-4`} />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="top"
                align={isRTL ? "start" : "end"}
                sideOffset={4}
              >
                <DropdownMenuItem onClick={() => navigate(`${basePath}/settings`)}>
                  <User2 className={`${isRTL ? 'ml-2' : 'mr-2'} size-4`} />
                  {t('nav.profile')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === 'dark' ? (
                    <Sun className={`${isRTL ? 'ml-2' : 'mr-2'} size-4`} />
                  ) : (
                    <Moon className={`${isRTL ? 'ml-2' : 'mr-2'} size-4`} />
                  )}
                  {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <LanguageSwitcher />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className={`${isRTL ? 'ml-2' : 'mr-2'} size-4`} />
                  {t('nav.signOut')}
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

// Pre-defined sections for teacher classroom
export const TEACHER_CLASSROOM_SECTIONS: ClassroomSection[] = [
  { id: 'overview', title: 'Overview', icon: Info },
  { id: 'assignments', title: 'Assignments', icon: BookOpen },
  { id: 'students', title: 'Students', icon: Users },
  { id: 'submissions', title: 'Submissions', icon: FileText },
  { id: 'analytics', title: 'Analytics', icon: BarChart3 },
];

// Pre-defined sections for student classroom
export const STUDENT_CLASSROOM_SECTIONS: ClassroomSection[] = [
  { id: 'overview', title: 'Overview', icon: Info },
  { id: 'assignments', title: 'Assignments', icon: BookOpen },
];


