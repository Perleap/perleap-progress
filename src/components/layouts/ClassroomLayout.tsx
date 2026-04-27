import * as React from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { ClassroomSidebar } from './ClassroomSidebar';
import { TEACHER_CLASSROOM_SECTIONS, STUDENT_CLASSROOM_SECTIONS } from '@/config/classroomSections';
import { Separator } from '@/components/ui/separator';
import { usePageTransition } from '@/hooks/useGsapAnimations';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { NotificationDropdown } from '@/components/common/NotificationDropdown';
import { TeacherAssistantTrigger } from '@/components/ai/TeacherAssistant';
import { USER_ROLES } from '@/config/constants';


interface ClassroomLayoutProps {
  children: React.ReactNode;
  classroomName?: string;
  classroomSubject?: string;
  activeSection: string;
  onSectionChange: (section: string) => void;
  customSections?: Array<{
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    disabled?: boolean;
  }>;
  /** When true, hides Dashboard / Planner in the classroom sidebar (student shell). */
  hideGlobalNav?: boolean;
}

export function ClassroomLayout({
  children,
  classroomName,
  classroomSubject,
  activeSection,
  onSectionChange,
  customSections,
  hideGlobalNav = false,
}: ClassroomLayoutProps) {
  const { t } = useTranslation();
  const { profile, user } = useAuth();
  const { isRTL } = useLanguage();
  const contentRef = usePageTransition([activeSection]);

  const isTeacher =
    user?.user_metadata?.role === 'teacher' || user?.user_metadata?.role === 'admin';
  const isAdmin = user?.user_metadata?.role === USER_ROLES.ADMIN;

  // Use custom sections if provided, otherwise use defaults based on role
  const sections = React.useMemo(() => {
    if (customSections) return customSections;

    const defaultSections = isTeacher ? TEACHER_CLASSROOM_SECTIONS : STUDENT_CLASSROOM_SECTIONS;

    // Translate section titles
    return defaultSections.map((section) => ({
      ...section,
      title: t(`classroomSections.${section.id}`, section.title),
    }));
  }, [customSections, isTeacher, t]);

  return (
    <SidebarProvider className={isRTL ? 'rtl-sidebar' : ''}>
      <ClassroomSidebar
        classroomName={classroomName}
        classroomSubject={classroomSubject}
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        sections={sections}
        hideGlobalNav={hideGlobalNav}
      />
      <SidebarInset>
        <header className="flex min-h-24 shrink-0 items-center gap-4 border-b border-border/40 bg-gradient-to-r from-background via-background/95 to-background px-4 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 md:px-5 sticky top-0 z-30">
          <div className="flex flex-1 items-center gap-4">
            <SidebarTrigger className="rounded-lg border border-transparent p-2.5 shadow-sm transition-all duration-200 hover:scale-110 hover:border-accent-foreground/10 hover:bg-accent hover:shadow-md" />
            <Separator orientation="vertical" className="h-8 bg-border/60" />
            <div className="min-w-0 flex-1" aria-hidden />
          </div>
          {user && (
            <div className="flex items-center gap-2">
              {isTeacher && <TeacherAssistantTrigger />}
              <NotificationDropdown userId={user.id} />
            </div>
          )}
        </header>
        <div
          ref={contentRef}
          className="flex flex-1 flex-col gap-4 p-3 sm:p-4 md:p-5 pt-3 sm:pt-4 bg-gradient-to-br from-background via-background to-muted/5 min-h-0"
        >
          {isAdmin && (
            <div
              role="status"
              className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100"
            >
              {t('admin.modeBanner')}
            </div>
          )}
          <div className="pt-4 sm:pt-6 md:pt-8">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// Sections moved to @/config/classroomSections



