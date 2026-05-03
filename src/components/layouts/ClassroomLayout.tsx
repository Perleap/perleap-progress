import * as React from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { ClassroomSidebar } from './ClassroomSidebar';
import { TEACHER_CLASSROOM_SECTIONS, STUDENT_CLASSROOM_SECTIONS } from '@/config/classroomSections';
import { usePageTransition } from '@/hooks/useGsapAnimations';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { USER_ROLES } from '@/config/constants';
import { FloatingShellActions } from './FloatingShellActions';

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
  const { user } = useAuth();
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
        <FloatingShellActions userId={user?.id} showTeacherAssistant={isTeacher} />
        <div
          ref={contentRef}
          className="flex min-h-0 flex-1 flex-col gap-3 pt-12 sm:pt-14 bg-gradient-to-br from-background via-background to-muted/5 p-3 sm:p-4 md:p-5"
        >
          {isAdmin && (
            <div
              role="status"
              className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100"
            >
              {t('admin.modeBanner')}
            </div>
          )}
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
