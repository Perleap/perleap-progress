import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { ClassroomActivityContent } from '@/components/features/syllabus/ClassroomActivityContent';
import {
  ClassroomActivityNavShell,
  useClassroomActivityNav,
} from '@/components/features/syllabus/ClassroomActivityNav';
import {
  useClassroom,
  useSyllabus,
  useSectionResourceById,
  useModuleFlowSteps,
  useClassroomAssignments,
} from '@/hooks/queries';
import {
  getOrderedActivityCenterFlowSteps,
  studentModuleFlowStepOptions,
  type AssignmentRow,
} from '@/lib/moduleFlow';
import { useStudentSectionModuleFlow } from '@/hooks/useStudentSectionModuleFlow';
import { canAccessPersistedStep } from '@/lib/moduleFlowStudent';
import type { SectionResource } from '@/types/syllabus';
import type { ActivityLinkState } from '@/types/navigation';
import { useMemo } from 'react';
import { isAppAdminRole } from '@/utils/role';

type Role = 'teacher' | 'student';

function resourceBelongsToSyllabus(
  resource: SectionResource | null | undefined,
  syllabus: { sections: { id: string }[] } | null | undefined,
): boolean {
  if (!resource || !syllabus?.sections?.length) return false;
  return syllabus.sections.some((s) => s.id === resource.section_id);
}

export type ClassroomActivityPageContentProps = {
  role: Role;
  classroomId: string;
  resourceId: string;
};

export function ClassroomActivityPageContent({
  role,
  classroomId,
  resourceId,
}: ClassroomActivityPageContentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const returnClassroomSection = (location.state as ActivityLinkState | null)?.returnClassroomSection;

  const { data: classroom, isLoading: loadingClass } = useClassroom(classroomId);
  const { data: syllabus, isLoading: loadingSyl } = useSyllabus(classroomId);
  const { data: resource, isLoading: loadingRes, isError } = useSectionResourceById(resourceId);
  const { data: classroomAssignments = [] } = useClassroomAssignments(classroomId);

  const { navSections, activeClassroomNavSection, handleClassroomNav, goBackFromActivity } =
    useClassroomActivityNav({
      role,
      classroomId,
      returnClassroomSection,
      syllabusPublished: syllabus?.status === 'published',
    });

  const { data: flowSteps = [] } = useModuleFlowSteps(resource?.section_id);

  const sectionResources = useMemo(
    () => (resource?.section_id ? syllabus?.section_resources?.[resource.section_id] ?? [] : []),
    [syllabus?.section_resources, resource?.section_id],
  );

  const studentFlowOpts = useMemo(
    () =>
      role === 'student'
        ? studentModuleFlowStepOptions(classroomAssignments as Array<{ id: string; type?: string | null }>)
        : undefined,
    [role, classroomAssignments],
  );

  const orderedFlowSteps = useMemo(
    () => getOrderedActivityCenterFlowSteps(flowSteps, sectionResources, studentFlowOpts),
    [flowSteps, sectionResources, studentFlowOpts],
  );

  const flowStepForResource = useMemo(
    () => flowSteps.find((s) => s.step_kind === 'resource' && s.activity_list_id === resource?.id),
    [flowSteps, resource?.id],
  );

  const sectionFlow = useStudentSectionModuleFlow(
    classroomId,
    resource?.section_id,
    role === 'student' ? user?.id : undefined,
  );

  const isTeacherTryPreview =
    role === 'teacher' && location.pathname.includes('/try/activity/');

  const valid = resourceBelongsToSyllabus(resource ?? null, syllabus ?? null);
  const isTeacherView =
    role === 'teacher' &&
    user?.id &&
    (classroom?.teacher_id === user.id || isAppAdminRole(user.user_metadata?.role));
  const isStudentView = role === 'student';

  const flowStepIndex = useMemo(
    () =>
      isStudentView && flowStepForResource && orderedFlowSteps.length > 0
        ? orderedFlowSteps.findIndex((s) => s.id === flowStepForResource.id)
        : -1,
    [isStudentView, flowStepForResource, orderedFlowSteps],
  );

  const loading =
    loadingClass ||
    loadingSyl ||
    loadingRes ||
    (isStudentView && !!resource?.section_id && sectionFlow.loading);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !resource || !valid) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center">
        <p className="text-muted-foreground mb-4">{t('activityPage.notFound')}</p>
        <Button variant="outline" onClick={goBackFromActivity}>
          {t('common.back')}
        </Button>
      </div>
    );
  }

  const sequentialBlocked =
    isStudentView &&
    flowStepForResource &&
    orderedFlowSteps.length > 0 &&
    flowStepIndex >= 0 &&
    !canAccessPersistedStep(orderedFlowSteps, flowStepIndex, sectionFlow.ctx, {
      assignments: sectionFlow.assignments as AssignmentRow[],
      now: new Date(),
    });

  if (sequentialBlocked) {
    return (
      <ClassroomActivityNavShell
        role={role}
        classroomName={classroom?.name}
        classroomSubject={classroom?.subject}
        navSections={navSections}
        activeSection={activeClassroomNavSection}
        onSectionChange={handleClassroomNav}
        isRTL={isRTL}
        onBack={goBackFromActivity}
        showBackButton={false}
      >
        <div className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
          <Lock className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden />
          <h1 className="text-xl font-semibold">{t('activityPage.sequentialBlockedTitle')}</h1>
          <p className="text-muted-foreground">{t('activityPage.sequentialBlockedBody')}</p>
          <Button
            type="button"
            onClick={() =>
              navigate(`/student/classroom/${classroomId}`, {
                state: { activeSection: 'curriculum' },
              })
            }
          >
            {t('activityPage.backToActivities')}
          </Button>
        </div>
      </ClassroomActivityNavShell>
    );
  }

  return (
    <ClassroomActivityNavShell
      role={role}
      classroomName={classroom?.name}
      classroomSubject={classroom?.subject}
      navSections={navSections}
      activeSection={activeClassroomNavSection}
      onSectionChange={handleClassroomNav}
      isRTL={isRTL}
      onBack={goBackFromActivity}
    >
      <ClassroomActivityContent
        role={role}
        classroomId={classroomId}
        resource={resource}
        isRTL={isRTL}
        isTeacherView={!!isTeacherView}
        isTeacherTryPreview={isTeacherTryPreview}
        isStudentView={isStudentView}
        sectionResources={sectionResources}
        syllabusSections={syllabus?.sections}
        syllabusSectionResources={syllabus?.section_resources}
      />
    </ClassroomActivityNavShell>
  );
}
