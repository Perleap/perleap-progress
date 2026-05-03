import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ArrowLeft, ChevronRight, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ClassroomLayout } from '@/components/layouts';
import { getStudentClassroomNavSections, getTeacherClassroomNavSections } from '@/lib/classroomNavSections';
import { lessonActivityColumnClass } from '@/components/features/syllabus/content-blocks';
import { LessonResourceBody, ResourceViewer } from '@/components/features/syllabus/ResourceViewer';
import {
  useClassroom,
  useSyllabus,
  useSectionResourceById,
  useModuleFlowSteps,
  useMarkFlowStepComplete,
  useStudentModuleFlowProgressMap,
  useClassroomAssignments,
} from '@/hooks/queries';
import { getNextActivityCenterStep, getOrderedActivityCenterFlowSteps, type AssignmentRow } from '@/lib/moduleFlow';
import { getFirstNavigableInSection, getNextSectionId } from '@/lib/moduleFlowNavigation';
import { navigateBackOrTo } from '@/hooks/useNavigateBack';
import { useStudentSectionModuleFlow } from '@/hooks/useStudentSectionModuleFlow';
import { canAccessPersistedStep } from '@/lib/moduleFlowStudent';
import type { SectionResource } from '@/types/syllabus';
import type { ActivityLinkState } from '@/types/navigation';
import { useCallback, useMemo } from 'react';
import { isAppAdminRole } from '@/utils/role';

type Role = 'teacher' | 'student';

function resourceBelongsToSyllabus(resource: SectionResource | null | undefined, syllabus: { sections: { id: string }[] } | null | undefined): boolean {
  if (!resource || !syllabus?.sections?.length) return false;
  return syllabus.sections.some((s) => s.id === resource.section_id);
}

export default function ClassroomActivityPage({ role }: { role: Role }) {
  const { t } = useTranslation();
  const { id: idParam, classroomId: classroomIdParam, resourceId } = useParams<{
    id?: string;
    classroomId?: string;
    resourceId: string;
  }>();
  const classroomId = classroomIdParam ?? idParam;
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const returnClassroomSection = (location.state as ActivityLinkState | null)?.returnClassroomSection;

  const { data: classroom, isLoading: loadingClass } = useClassroom(classroomId);
  const { data: syllabus, isLoading: loadingSyl } = useSyllabus(classroomId);
  const { data: resource, isLoading: loadingRes, isError } = useSectionResourceById(resourceId);

  const { data: flowSteps = [] } = useModuleFlowSteps(resource?.section_id);

  const nextSectionId = useMemo(
    () => getNextSectionId(syllabus?.sections, resource?.section_id),
    [syllabus?.sections, resource?.section_id],
  );
  const { data: nextSectionFlowSteps = [] } = useModuleFlowSteps(nextSectionId);
  const { data: classroomAssignments = [] } = useClassroomAssignments(classroomId);

  const firstInNextSection = useMemo(() => {
    if (!nextSectionId) return null;
    return getFirstNavigableInSection({
      sectionId: nextSectionId,
      sectionResources: syllabus?.section_resources?.[nextSectionId] ?? [],
      assignments: classroomAssignments as AssignmentRow[],
      persistedSteps: nextSectionFlowSteps,
    });
  }, [nextSectionId, syllabus?.section_resources, classroomAssignments, nextSectionFlowSteps]);

  const flowStepForResource = useMemo(
    () => flowSteps.find((s) => s.step_kind === 'resource' && s.activity_list_id === resource?.id),
    [flowSteps, resource?.id],
  );

  const sectionResources = useMemo(
    () => (resource?.section_id ? syllabus?.section_resources?.[resource.section_id] ?? [] : []),
    [syllabus?.section_resources, resource?.section_id],
  );

  const orderedFlowSteps = useMemo(
    () => getOrderedActivityCenterFlowSteps(flowSteps, sectionResources),
    [flowSteps, sectionResources],
  );

  const flowStepIds = useMemo(() => orderedFlowSteps.map((s) => s.id), [orderedFlowSteps]);

  const { data: progressByStep = {} } = useStudentModuleFlowProgressMap(
    role === 'student' ? user?.id : undefined,
    flowStepIds,
  );

  const sectionFlow = useStudentSectionModuleFlow(
    classroomId,
    resource?.section_id,
    role === 'student' ? user?.id : undefined,
  );

  const nextFlowStep = useMemo(() => {
    if (!flowStepForResource) return undefined;
    return getNextActivityCenterStep(orderedFlowSteps, flowStepForResource.id);
  }, [orderedFlowSteps, flowStepForResource]);

  const markComplete = useMarkFlowStepComplete();

  const isStepCompleted =
    role === 'student' &&
    !!flowStepForResource &&
    !!progressByStep[flowStepForResource.id];

  const goToNextFlowStep = useCallback(() => {
    if (!nextFlowStep || !classroomId || role !== 'student') return;
    if (nextFlowStep.step_kind === 'resource' && nextFlowStep.activity_list_id) {
      navigate(`/student/classroom/${classroomId}/activity/${nextFlowStep.activity_list_id}`, {
        state: { returnClassroomSection: 'curriculum' },
      });
    } else if (nextFlowStep.step_kind === 'assignment' && nextFlowStep.assignment_id) {
      navigate(`/student/assignment/${nextFlowStep.assignment_id}`, {
        state: { returnClassroomSection: 'curriculum' },
      });
    }
  }, [nextFlowStep, classroomId, navigate, role]);

  const goToNextModuleOrCurriculum = useCallback(() => {
    if (!classroomId || role !== 'student') return;
    if (firstInNextSection) {
      if (firstInNextSection.kind === 'resource') {
        navigate(`/student/classroom/${classroomId}/activity/${firstInNextSection.id}`, {
          state: { returnClassroomSection: 'curriculum' },
        });
      } else {
        navigate(`/student/assignment/${firstInNextSection.id}`, {
          state: { returnClassroomSection: 'curriculum' },
        });
      }
    } else {
      navigate(`/student/classroom/${classroomId}`, { state: { activeSection: 'curriculum' } });
    }
  }, [classroomId, role, firstInNextSection, navigate]);

  const proceedAfterStepDone = useCallback(() => {
    if (nextFlowStep) {
      goToNextFlowStep();
    } else {
      goToNextModuleOrCurriculum();
    }
  }, [nextFlowStep, goToNextFlowStep, goToNextModuleOrCurriculum]);

  const handleStudentContinue = useCallback(() => {
    if (role !== 'student' || !user?.id || !flowStepForResource || !classroomId || !resource) return;
    if (isStepCompleted) {
      proceedAfterStepDone();
      return;
    }
    markComplete.mutate(
      {
        studentId: user.id,
        moduleFlowStepId: flowStepForResource.id,
        sectionId: resource.section_id,
        classroomId,
      },
      {
        onSuccess: () => proceedAfterStepDone(),
        onError: () => toast.error(t('common.error')),
      },
    );
  }, [
    role,
    user?.id,
    flowStepForResource,
    classroomId,
    resource,
    isStepCompleted,
    proceedAfterStepDone,
    markComplete,
    t,
  ]);

  const navSections = useMemo(() => {
    if (role === 'teacher') return getTeacherClassroomNavSections(t);
    return getStudentClassroomNavSections(t, syllabus?.status === 'published');
  }, [role, syllabus?.status, t]);

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

  const handleClassroomNav = useCallback(
    (section: string) => {
      if (!classroomId) return;
      const path =
        role === 'teacher' ? `/teacher/classroom/${classroomId}` : `/student/classroom/${classroomId}`;
      navigate(path, { state: { activeSection: section } });
    },
    [classroomId, navigate, role],
  );

  const isTeacherTryPreview =
    role === 'teacher' && location.pathname.includes('/try/activity/');

  const goBackFromActivity = useCallback(() => {
    if (classroomId) {
      const path =
        role === 'teacher' ? `/teacher/classroom/${classroomId}` : `/student/classroom/${classroomId}`;
      const fallback = role === 'teacher' ? 'outline' : 'curriculum';
      let section = returnClassroomSection ?? fallback;
      if (role === 'teacher' && section === 'curriculum') section = 'outline';
      if (role === 'student' && section === 'outline') section = 'curriculum';
      if (section === 'activities' || section === 'assignments') {
        section = role === 'teacher' ? 'outline' : 'curriculum';
      }
      navigate(path, { state: { activeSection: section } });
      return;
    }
    navigateBackOrTo(
      navigate,
      role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard',
    );
  }, [classroomId, navigate, returnClassroomSection, role]);

  const valid = resourceBelongsToSyllabus(resource ?? null, syllabus ?? null);
  const isTeacherView =
    role === 'teacher' &&
    user?.id &&
    (classroom?.teacher_id === user.id || isAppAdminRole(user.user_metadata?.role));
  const isStudentView = role === 'student';

  const canMarkComplete =
    isStudentView &&
    user?.id &&
    resource &&
    flowStepForResource &&
    (resource.resource_type === 'lesson' ||
      resource.resource_type === 'text' ||
      resource.resource_type === 'video');

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

  if (!classroomId || !resourceId || isError || !resource || !valid) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center">
        <p className="text-muted-foreground mb-4">{t('activityPage.notFound')}</p>
        <Button variant="outline" onClick={goBackFromActivity}>
          {t('common.back')}
        </Button>
      </div>
    );
  }

  const flowStepIndex =
    isStudentView && flowStepForResource && orderedFlowSteps.length > 0
      ? orderedFlowSteps.findIndex((s) => s.id === flowStepForResource.id)
      : -1;

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
      <ClassroomLayout
        classroomName={classroom?.name}
        classroomSubject={classroom?.subject}
        activeSection={activeClassroomNavSection}
        onSectionChange={handleClassroomNav}
        customSections={navSections}
        hideGlobalNav={role === 'student'}
      >
        <div
          className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
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
      </ClassroomLayout>
    );
  }

  const showDraftBadge = resource.status === 'draft' && isTeacherView;
  const isLessonActivity = resource.resource_type === 'lesson';

  const activityHeader = (
    <header className="shrink-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!isLessonActivity ? (
          <Badge variant="secondary" className="rounded-full">
            {t(`activityPage.type.${resource.resource_type}`, resource.resource_type)}
          </Badge>
        ) : null}
        {showDraftBadge ? (
          <Badge variant="outline" className="rounded-full">
            {t('classroomDetail.activities.statusDraft')}
          </Badge>
        ) : null}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{resource.title}</h1>
      {resource.summary ? (
        <p className="text-sm text-muted-foreground md:text-base">{resource.summary}</p>
      ) : null}
    </header>
  );

  return (
    <ClassroomLayout
      classroomName={classroom?.name}
      classroomSubject={classroom?.subject}
      activeSection={activeClassroomNavSection}
      onSectionChange={handleClassroomNav}
      customSections={navSections}
      hideGlobalNav={role === 'student'}
    >
      <div
        className="flex w-full min-h-0 flex-1 flex-col gap-6 pb-8"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className={cn('flex shrink-0 items-center gap-3', isRTL && 'flex-row-reverse')}>
          <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={goBackFromActivity}>
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
        </div>

        {isTeacherTryPreview ? (
          <Alert className="border-primary/25 bg-primary/5 shrink-0">
            <AlertTitle>{t('teacherTry.activityPreviewTitle')}</AlertTitle>
            <AlertDescription>{t('teacherTry.activityPreviewDescription')}</AlertDescription>
          </Alert>
        ) : null}

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col border-b border-border/60 pb-8',
            isLessonActivity ? 'gap-8' : 'gap-6',
            isRTL && 'text-right',
          )}
        >
          {isLessonActivity ? (
            <div className={cn(lessonActivityColumnClass, 'flex min-h-0 flex-1 flex-col gap-8')}>
              {activityHeader}
              <div className="min-h-0 w-full flex-1">
                <LessonResourceBody resource={resource} variant="reading" isRTL={isRTL} />
              </div>
            </div>
          ) : (
            <>
              {activityHeader}
              <div className="min-h-0 w-full max-w-3xl flex-1 space-y-3">
                <ResourceViewer resources={[resource]} isRTL={isRTL} compact={false} />
              </div>
            </>
          )}
        </div>

        {canMarkComplete ? (
          <div className={cn('flex flex-wrap items-center gap-2', isRTL ? 'justify-start' : 'justify-end')}>
            <Button
              type="button"
              variant="outline"
              className="gap-1"
              onClick={handleStudentContinue}
              disabled={markComplete.isPending}
            >
              {markComplete.isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
              {t('activityPage.continue')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </ClassroomLayout>
  );
}
