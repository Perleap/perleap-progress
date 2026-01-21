import * as React from 'react';
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
import { TeacherAssistant } from '@/components/ai/TeacherAssistant';

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
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border/40 bg-gradient-to-r from-background via-background/95 to-background backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 px-6 shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-4 flex-1">
            <SidebarTrigger className="hover:bg-accent hover:scale-110 rounded-lg p-2.5 transition-all duration-200 shadow-sm hover:shadow-md border border-transparent hover:border-accent-foreground/10" />
            <Separator orientation="vertical" className="h-6 bg-border/60" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href={`${basePath}/dashboard`}>
                    {t('nav.dashboard')}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbPage>{classroomName || t('nav.classroom')}</BreadcrumbPage>
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
              <NotificationDropdown userId={user.id} />
            </div>
          )}
        </header>
        <div ref={contentRef} className="flex flex-1 flex-col gap-4 p-4 pt-0 bg-gradient-to-br from-background via-background to-muted/5 min-h-0">
          <div className="pt-4">
            {children}
          </div>
        </div>
        <TeacherAssistant />
      </SidebarInset>
    </SidebarProvider>
  );
}

// Sections moved to @/config/classroomSections



