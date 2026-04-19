import * as React from 'react';
import { Link } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { ClassroomSidebar } from './ClassroomSidebar';
import { TEACHER_CLASSROOM_SECTIONS, STUDENT_CLASSROOM_SECTIONS } from '@/config/classroomSections';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { usePageTransition } from '@/hooks/useGsapAnimations';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { NotificationDropdown } from '@/components/common/NotificationDropdown';
import { TeacherAssistantTrigger } from '@/components/ai/TeacherAssistant';


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
  }>;
}

export function ClassroomLayout({
  children,
  classroomName,
  classroomSubject,
  activeSection,
  onSectionChange,
  customSections,
}: ClassroomLayoutProps) {
  const { t } = useTranslation();
  const { profile, user } = useAuth();
  const { isRTL } = useLanguage();
  const contentRef = usePageTransition([activeSection]);

  const isTeacher = user?.user_metadata?.role === 'teacher';
  const basePath = isTeacher ? '/teacher' : '/student';

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

  const currentSection = sections.find((s) => s.id === activeSection);

  return (
    <SidebarProvider className={isRTL ? 'rtl-sidebar' : ''}>
      <ClassroomSidebar
        classroomName={classroomName}
        classroomSubject={classroomSubject}
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        sections={sections}
      />
      <SidebarInset>
        <header className="flex min-h-24 shrink-0 items-center gap-4 border-b border-border/40 bg-gradient-to-r from-background via-background/95 to-background px-4 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 md:px-5 sticky top-0 z-30">
          <div className="flex flex-1 items-center gap-4">
            <SidebarTrigger className="rounded-lg border border-transparent p-2.5 shadow-sm transition-all duration-200 hover:scale-110 hover:border-accent-foreground/10 hover:bg-accent hover:shadow-md" />
            <Separator orientation="vertical" className="h-8 bg-border/60" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink render={<Link to={`${basePath}/dashboard`} />}>
                    {t('nav.dashboard')}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {currentSection && (
                  <>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{currentSection.title}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
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
          <div className="pt-4 sm:pt-6 md:pt-8">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// Sections moved to @/config/classroomSections



