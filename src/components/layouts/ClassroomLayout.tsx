import * as React from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { ClassroomSidebar, TEACHER_CLASSROOM_SECTIONS, STUDENT_CLASSROOM_SECTIONS } from './ClassroomSidebar';
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
  const { profile } = useAuth();
  const { isRTL } = useLanguage();
  const contentRef = usePageTransition([activeSection]);
  
  const isTeacher = profile?.role === 'teacher';
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
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
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
        </header>
        <div ref={contentRef} className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="pt-4">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export { TEACHER_CLASSROOM_SECTIONS, STUDENT_CLASSROOM_SECTIONS };



