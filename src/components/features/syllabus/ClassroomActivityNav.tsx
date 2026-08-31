/* eslint-disable react-refresh/only-export-components -- co-located helpers/variants */
import { ArrowLeft } from 'lucide-react';
import { useCallback, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ClassroomLayout } from '@/components/layouts';
import { Button } from '@/components/ui/button';
import { navigateBackOrTo } from '@/hooks/useNavigateBack';
import {
  getStudentClassroomNavSections,
  getTeacherClassroomNavSections,
  type ClassroomNavSection,
} from '@/lib/classroomNavSections';
import { cn } from '@/lib/utils';

type Role = 'teacher' | 'student';

export type UseClassroomActivityNavOptions = {
  role: Role;
  classroomId: string | undefined;
  returnClassroomSection: string | undefined;
  syllabusPublished: boolean;
};

export function useClassroomActivityNav({
  role,
  classroomId,
  returnClassroomSection,
  syllabusPublished,
}: UseClassroomActivityNavOptions) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const navSections = useMemo(() => {
    if (role === 'teacher') return getTeacherClassroomNavSections(t);
    return getStudentClassroomNavSections(t, syllabusPublished);
  }, [role, syllabusPublished, t]);

  const allowedNavIds = useMemo(() => new Set(navSections.map((s) => s.id)), [navSections]);

  const activeClassroomNavSection = useMemo(() => {
    const fallback = role === 'teacher' ? 'outline' : 'curriculum';
    const raw = returnClassroomSection ?? fallback;
    let normalized =
      raw === 'activities' || raw === 'assignments'
        ? role === 'teacher'
          ? 'outline'
          : 'curriculum'
        : raw;
    if (role === 'teacher' && normalized === 'curriculum') normalized = 'outline';
    if (role === 'student' && normalized === 'outline') normalized = 'curriculum';
    if (normalized && allowedNavIds.has(normalized)) return normalized;
    return 'overview';
  }, [returnClassroomSection, allowedNavIds, role]);

  const resolveReturnSection = useCallback(() => {
    const fallback = role === 'teacher' ? 'outline' : 'curriculum';
    let section = returnClassroomSection ?? fallback;
    if (role === 'teacher' && section === 'curriculum') section = 'outline';
    if (role === 'student' && section === 'outline') section = 'curriculum';
    if (section === 'activities' || section === 'assignments') {
      section = role === 'teacher' ? 'outline' : 'curriculum';
    }
    return section;
  }, [returnClassroomSection, role]);

  const handleClassroomNav = useCallback(
    (section: string) => {
      if (!classroomId) return;
      const path =
        role === 'teacher'
          ? `/teacher/classroom/${classroomId}`
          : `/student/classroom/${classroomId}`;
      navigate(path, { state: { activeSection: section } });
    },
    [classroomId, navigate, role]
  );

  const goBackFromActivity = useCallback(() => {
    if (classroomId) {
      const path =
        role === 'teacher'
          ? `/teacher/classroom/${classroomId}`
          : `/student/classroom/${classroomId}`;
      navigate(path, { state: { activeSection: resolveReturnSection() } });
      return;
    }
    navigateBackOrTo(navigate, role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
  }, [classroomId, navigate, resolveReturnSection, role]);

  return {
    navSections,
    activeClassroomNavSection,
    handleClassroomNav,
    goBackFromActivity,
  };
}

export type ClassroomActivityBackButtonProps = {
  onBack: () => void;
  isRTL: boolean;
};

export const ClassroomActivityBackButton = ({
  onBack,
  isRTL,
}: ClassroomActivityBackButtonProps) => {
  const { t } = useTranslation();

  return (
    <div className={cn('flex shrink-0 items-center gap-3', isRTL && 'flex-row-reverse')}>
      <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </Button>
    </div>
  );
};

export type ClassroomActivityNavShellProps = {
  role: Role;
  classroomName?: string | null;
  classroomSubject?: string | null;
  navSections: ClassroomNavSection[];
  activeSection: string;
  onSectionChange: (section: string) => void;
  isRTL: boolean;
  onBack: () => void;
  showBackButton?: boolean;
  children: ReactNode;
};

export const ClassroomActivityNavShell = ({
  role,
  classroomName,
  classroomSubject,
  navSections,
  activeSection,
  onSectionChange,
  isRTL,
  onBack,
  showBackButton = true,
  children,
}: ClassroomActivityNavShellProps) => {
  return (
    <ClassroomLayout
      classroomName={classroomName ?? undefined}
      classroomSubject={classroomSubject ?? undefined}
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      customSections={navSections}
      hideGlobalNav={role === 'student'}
    >
      <div className="flex w-full min-h-0 flex-1 flex-col gap-6 pb-8" dir={isRTL ? 'rtl' : 'ltr'}>
        {showBackButton ? <ClassroomActivityBackButton onBack={onBack} isRTL={isRTL} /> : null}
        {children}
      </div>
    </ClassroomLayout>
  );
};
