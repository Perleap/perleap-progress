import { ArrowLeft } from 'lucide-react';
import { useCallback, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ClassroomNavSection } from '@/lib/classroomNavSections';
import type { AssignmentLinkState } from '@/types/navigation';
import { ClassroomLayout } from '@/components/layouts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { canGoBackInHistory, navigateBackOrTo } from '@/hooks/useNavigateBack';
import {
  getStudentClassroomNavSections,
  getTeacherClassroomNavSections,
} from '@/lib/classroomNavSections';
import { cn } from '@/lib/utils';

export type UseAssignmentDetailNavOptions = {
  isTeacherTry: boolean;
  teacherRouteClassroomId?: string;
  classroomId?: string;
  linkState: AssignmentLinkState | null;
  syllabusPublished: boolean;
};

export function useAssignmentDetailNav({
  isTeacherTry,
  teacherRouteClassroomId,
  classroomId,
  linkState,
  syllabusPublished,
}: UseAssignmentDetailNavOptions) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const studentNavSections = useMemo(
    () => getStudentClassroomNavSections(t, syllabusPublished),
    [syllabusPublished, t]
  );

  const teacherNavSections = useMemo(() => getTeacherClassroomNavSections(t), [t]);

  const allowedNavIds = useMemo(
    () => new Set(studentNavSections.map((s) => s.id)),
    [studentNavSections]
  );

  const activeClassroomNavSection = useMemo(() => {
    const preferred = 'curriculum';
    if (allowedNavIds.has(preferred)) return preferred;
    return 'overview';
  }, [allowedNavIds]);

  const handleClassroomNav = useCallback(
    (section: string) => {
      if (!classroomId) return;
      navigate(`/student/classroom/${classroomId}`, { state: { activeSection: section } });
    },
    [classroomId, navigate]
  );

  const handleTeacherClassroomNav = useCallback(
    (section: string) => {
      if (!teacherRouteClassroomId) return;
      navigate(`/teacher/classroom/${teacherRouteClassroomId}`, {
        replace: true,
        state: { activeSection: section },
      });
    },
    [teacherRouteClassroomId, navigate]
  );

  const handleBackFromAssignment = useCallback(() => {
    if (isTeacherTry && teacherRouteClassroomId) {
      navigate(`/teacher/classroom/${teacherRouteClassroomId}`, {
        state: { activeSection: 'outline' },
        replace: true,
      });
      return;
    }
    if (linkState?.fromStudentDashboard) {
      navigate('/student/dashboard');
      return;
    }
    if (classroomId) {
      navigate(`/student/classroom/${classroomId}`, {
        state: { activeSection: linkState?.returnClassroomSection ?? 'curriculum' },
        replace: true,
      });
      return;
    }
    if (canGoBackInHistory()) {
      navigate(-1);
      return;
    }
    navigateBackOrTo(navigate, '/student/dashboard');
  }, [classroomId, linkState, navigate, isTeacherTry, teacherRouteClassroomId]);

  return {
    studentNavSections,
    teacherNavSections,
    activeClassroomNavSection,
    handleClassroomNav,
    handleTeacherClassroomNav,
    handleBackFromAssignment,
  };
}

export type AssignmentDetailLayoutProps = {
  isTeacherTry: boolean;
  classroomName?: string | null;
  classroomSubject?: string | null;
  studentNavSections: ClassroomNavSection[];
  teacherNavSections: ClassroomNavSection[];
  activeClassroomNavSection: string;
  onClassroomNav: (section: string) => void;
  onTeacherClassroomNav: (section: string) => void;
  children: ReactNode;
};

export const AssignmentDetailLayout = ({
  isTeacherTry,
  classroomName,
  classroomSubject,
  studentNavSections,
  teacherNavSections,
  activeClassroomNavSection,
  onClassroomNav,
  onTeacherClassroomNav,
  children,
}: AssignmentDetailLayoutProps) => {
  return (
    <ClassroomLayout
      classroomName={classroomName ?? undefined}
      classroomSubject={classroomSubject ?? undefined}
      activeSection={isTeacherTry ? 'outline' : activeClassroomNavSection}
      onSectionChange={isTeacherTry ? onTeacherClassroomNav : onClassroomNav}
      customSections={isTeacherTry ? teacherNavSections : studentNavSections}
      hideGlobalNav={!isTeacherTry}
    >
      {children}
    </ClassroomLayout>
  );
};

export type AssignmentDetailBackBarProps = {
  isTeacherTry: boolean;
  isRTL: boolean;
  onBack: () => void;
};

export const AssignmentDetailBackBar = ({
  isTeacherTry,
  isRTL,
  onBack,
}: AssignmentDetailBackBarProps) => {
  const { t } = useTranslation();

  return (
    <div className={cn('flex shrink-0 flex-wrap items-center gap-3', isRTL && 'flex-row-reverse')}>
      <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </Button>
      {isTeacherTry ? (
        <Badge
          variant="secondary"
          className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-medium text-primary"
        >
          {t('teacherTry.bannerTitle')}
        </Badge>
      ) : null}
    </div>
  );
};
