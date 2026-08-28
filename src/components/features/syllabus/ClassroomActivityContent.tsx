import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { cn } from '@/lib/utils';
import { lessonActivityColumnClass } from '@/components/features/syllabus/content-blocks';
import { ResolvedLessonResourceBody, ResourceViewer } from '@/components/features/syllabus/ResourceViewer';
import {
  useModuleFlowSteps,
  useMarkFlowStepComplete,
  useStudentModuleFlowProgressMap,
  useClassroomAssignments,
} from '@/hooks/queries';
import {
  getNextActivityCenterStep,
  getOrderedActivityCenterFlowSteps,
  filterOutlineMaterialResources,
  studentModuleFlowStepOptions,
  type AssignmentRow,
} from '@/lib/moduleFlow';
import { getFirstNavigableInSection, getNextSectionId } from '@/lib/moduleFlowNavigation';
import type { SectionResource } from '@/types/syllabus';

type Role = 'teacher' | 'student';

export type ClassroomActivityContentProps = {
  role: Role;
  classroomId: string;
  resource: SectionResource;
  isRTL: boolean;
  isTeacherView: boolean;
  isTeacherTryPreview: boolean;
  isStudentView: boolean;
  sectionResources: SectionResource[];
  syllabusSections: { id: string }[] | undefined;
  syllabusSectionResources: Record<string, SectionResource[]> | undefined;
};

export function ClassroomActivityContent({
  role,
  classroomId,
  resource,
  isRTL,
  isTeacherView,
  isTeacherTryPreview,
  isStudentView,
  sectionResources,
  syllabusSections,
  syllabusSectionResources,
}: ClassroomActivityContentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const videoTracking =
    role === 'student' && user?.id && classroomId
      ? { classroomId, studentUserId: user.id }
      : undefined;

  const { data: flowSteps = [] } = useModuleFlowSteps(resource.section_id);

  const nextSectionId = useMemo(
    () => getNextSectionId(syllabusSections, resource.section_id),
    [syllabusSections, resource.section_id],
  );
  const { data: nextSectionFlowSteps = [] } = useModuleFlowSteps(nextSectionId);
  const { data: classroomAssignments = [] } = useClassroomAssignments(classroomId);

  const studentFlowOpts = useMemo(
    () =>
      role === 'student'
        ? studentModuleFlowStepOptions(classroomAssignments as Array<{ id: string; type?: string | null }>)
        : undefined,
    [role, classroomAssignments],
  );

  const firstInNextSection = useMemo(() => {
    if (!nextSectionId) return null;
    return getFirstNavigableInSection({
      sectionId: nextSectionId,
      sectionResources: syllabusSectionResources?.[nextSectionId] ?? [],
      assignments: classroomAssignments as AssignmentRow[],
      persistedSteps: nextSectionFlowSteps,
      flowStepOptions: studentFlowOpts,
    });
  }, [
    nextSectionId,
    syllabusSectionResources,
    classroomAssignments,
    nextSectionFlowSteps,
    studentFlowOpts,
  ]);

  const flowStepForResource = useMemo(
    () => flowSteps.find((s) => s.step_kind === 'resource' && s.activity_list_id === resource.id),
    [flowSteps, resource.id],
  );

  const orderedFlowSteps = useMemo(
    () => getOrderedActivityCenterFlowSteps(flowSteps, sectionResources, studentFlowOpts),
    [flowSteps, sectionResources, studentFlowOpts],
  );

  const unitOutlineMaterials = useMemo(
    () =>
      filterOutlineMaterialResources(sectionResources, {
        excludeDrafts: role === 'student',
        excludeResourceId: resource.id,
      }),
    [sectionResources, role, resource.id],
  );

  const [unitMaterialsOpen, setUnitMaterialsOpen] = useState(false);

  const flowStepIds = useMemo(() => orderedFlowSteps.map((s) => s.id), [orderedFlowSteps]);

  const { data: progressByStep = {} } = useStudentModuleFlowProgressMap(
    role === 'student' ? user?.id : undefined,
    flowStepIds,
  );

  const nextFlowStep = useMemo(() => {
    if (!flowStepForResource) return undefined;
    return getNextActivityCenterStep(orderedFlowSteps, flowStepForResource.id);
  }, [orderedFlowSteps, flowStepForResource]);

  const markComplete = useMarkFlowStepComplete();

  const isStepCompleted =
    role === 'student' && !!flowStepForResource && !!progressByStep[flowStepForResource.id];

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
    if (role !== 'student' || !user?.id || !flowStepForResource || !classroomId) return;
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
    resource.section_id,
    isStepCompleted,
    proceedAfterStepDone,
    markComplete,
    t,
  ]);

  const showDraftBadge = resource.status === 'draft' && isTeacherView;
  const isLessonActivity = resource.resource_type === 'lesson';

  const canMarkComplete =
    isStudentView &&
    user?.id &&
    flowStepForResource &&
    (resource.resource_type === 'lesson' ||
      resource.resource_type === 'text' ||
      resource.resource_type === 'video');

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
    <>
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
              <ResolvedLessonResourceBody
                resource={resource}
                variant="reading"
                isRTL={isRTL}
                videoTracking={videoTracking}
              />
            </div>
          </div>
        ) : (
          <>
            {activityHeader}
            <div className="min-h-0 w-full max-w-3xl flex-1 space-y-3">
              <ResourceViewer
                resources={[resource]}
                isRTL={isRTL}
                compact={false}
                videoTracking={videoTracking}
              />
            </div>
          </>
        )}
      </div>

      {unitOutlineMaterials.length > 0 ? (
        <div className="shrink-0 border-b border-border/60 pb-8" dir={isRTL ? 'rtl' : 'ltr'}>
          <Collapsible
            open={unitMaterialsOpen}
            onOpenChange={setUnitMaterialsOpen}
            className="overflow-hidden rounded-lg border border-border/60 bg-muted/5"
          >
            <CollapsibleTrigger
              className={cn(
                'flex w-full items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5 text-start outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/50',
                isRTL ? 'text-end' : 'text-start',
              )}
            >
              <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                {t('assignmentDetail.referenceMaterials', { count: unitOutlineMaterials.length })}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  unitMaterialsOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pb-3 pt-1">
              <ResourceViewer
                resources={unitOutlineMaterials}
                isRTL={isRTL}
                compact
                compactVariant="list"
                hideListHeader
                videoTracking={videoTracking}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : null}

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
    </>
  );
}
