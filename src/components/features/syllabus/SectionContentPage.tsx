import { useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Target,
  BookOpen,
  ClipboardList,
  FileText,
  Lock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { RichTextViewer } from '@/components/ui/rich-text-editor';
import { useAuth } from '@/contexts/useAuth';
import {
  useUpdateStudentProgress,
  useStudentModuleFlowProgressMap,
  useAssignmentSubmittedOrCompletedMap,
} from '@/hooks/queries';
import { isSectionUnlocked, sectionsInCourseOrder } from '@/lib/sectionUnlock';
import { getOrderedActivityCenterFlowSteps } from '@/lib/moduleFlow';
import { persistedStepDone } from '@/lib/moduleFlowStudent';
import type {
  SyllabusSection,
  SectionResource,
  StudentProgressStatus,
  ReleaseMode,
  ModuleFlowStep,
} from '@/types/syllabus';

interface SectionContentPageProps {
  sectionId: string;
  classroomId: string;
  /** Persisted teacher module flow; when non-empty, outline shows assignments + activity steps in order. */
  moduleFlowSteps: ModuleFlowStep[];
  sections: SyllabusSection[];
  sectionResources: Record<string, SectionResource[]>;
  linkedAssignmentsMap: Record<string, Array<{ id: string; title: string; type: string; due_at: string | null }>>;
  syllabusId: string;
  releaseMode: ReleaseMode;
  studentProgressMap: Record<string, StudentProgressStatus>;
  isRTL: boolean;
  onBack: () => void;
  onNavigateSection: (sectionId: string) => void;
}

const EMPTY_LINKED_ASSIGNMENTS: Array<{
  id: string;
  title: string;
  type: string;
  due_at: string | null;
}> = [];

export const SectionContentPage = ({
  sectionId,
  classroomId,
  moduleFlowSteps,
  sections,
  sectionResources,
  linkedAssignmentsMap,
  syllabusId,
  releaseMode,
  studentProgressMap,
  isRTL,
  onBack,
  onNavigateSection,
}: SectionContentPageProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const updateProgress = useUpdateStudentProgress();

  const sortedSections = useMemo(() => sectionsInCourseOrder(sections), [sections]);
  const currentIndex = sortedSections.findIndex((s) => s.id === sectionId);
  const section = sortedSections[currentIndex];
  const prevSection = currentIndex > 0 ? sortedSections[currentIndex - 1] : null;
  const nextSection = currentIndex < sortedSections.length - 1 ? sortedSections[currentIndex + 1] : null;
  const resources = sectionResources[sectionId] || [];
  const assignments = useMemo(
    () => linkedAssignmentsMap[sectionId] ?? EMPTY_LINKED_ASSIGNMENTS,
    [linkedAssignmentsMap, sectionId],
  );
  const orderedFlow = useMemo(
    () =>
      moduleFlowSteps.length > 0
        ? getOrderedActivityCenterFlowSteps(moduleFlowSteps, resources)
        : [],
    [moduleFlowSteps, resources],
  );
  const useFlowList = orderedFlow.length > 0;
  const assignmentById = useMemo(() => {
    const m: Record<string, (typeof assignments)[number]> = {};
    assignments.forEach((a) => {
      m[a.id] = a;
    });
    return m;
  }, [assignments]);
  const resourceById = useMemo(() => {
    const m: Record<string, SectionResource> = {};
    resources.forEach((r) => {
      m[r.id] = r;
    });
    return m;
  }, [resources]);

  const flowStepIds = useMemo(() => orderedFlow.map((s) => s.id), [orderedFlow]);

  const { data: progressByStep = {} } = useStudentModuleFlowProgressMap(user?.id, flowStepIds);

  const assignmentIdsForSubmissionQuery = useMemo(() => {
    if (useFlowList) {
      const ids: string[] = [];
      for (const step of orderedFlow) {
        if (
          step.step_kind === 'assignment' &&
          step.assignment_id &&
          assignmentById[step.assignment_id]
        ) {
          ids.push(step.assignment_id);
        }
      }
      return ids;
    }
    return assignments.map((a) => a.id);
  }, [useFlowList, orderedFlow, assignmentById, assignments]);

  const { data: assignmentDoneMap = {} } = useAssignmentSubmittedOrCompletedMap(
    assignmentIdsForSubmissionQuery,
    user?.id,
  );

  const moduleProgressStats = useMemo(() => {
    if (useFlowList) {
      const flowCtx = { progressByStep, assignmentDoneMap };
      let total = 0;
      let done = 0;
      orderedFlow.forEach((step, i) => {
        if (step.step_kind === 'resource' && step.activity_list_id) {
          if (!resourceById[step.activity_list_id]) return;
          total += 1;
          if (persistedStepDone(step, orderedFlow, i, flowCtx)) done += 1;
        } else if (step.step_kind === 'assignment' && step.assignment_id) {
          if (!assignmentById[step.assignment_id]) return;
          total += 1;
          if (persistedStepDone(step, orderedFlow, i, flowCtx)) done += 1;
        }
      });
      return {
        total,
        done,
        percent: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    }
    const total = assignments.length;
    let done = 0;
    for (const a of assignments) {
      if (assignmentDoneMap[a.id]) done += 1;
    }
    return {
      total,
      done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [useFlowList, orderedFlow, resourceById, assignmentById, progressByStep, assignmentDoneMap, assignments]);

  const studentProgress = studentProgressMap[sectionId];

  useEffect(() => {
    if (
      moduleProgressStats.total > 0 &&
      moduleProgressStats.done >= moduleProgressStats.total &&
      studentProgress !== 'completed' &&
      user?.id &&
      section?.id
    ) {
      updateProgress.mutate({
        sectionId: section.id,
        studentId: user.id,
        status: 'completed',
        syllabusId,
      });
    }
  }, [moduleProgressStats, studentProgress, user?.id, section?.id, syllabusId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!section) return null;

  const locked = !isSectionUnlocked(section, sortedSections, releaseMode, studentProgressMap);

  const topNavRow = (
    <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
      <Button variant="ghost" onClick={onBack} className="rounded-full gap-1.5">
        {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
        {t('common.back', 'Back')}
      </Button>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!prevSection}
          onClick={() => prevSection && onNavigateSection(prevSection.id)}
          className="rounded-full gap-1 h-8"
        >
          {isRTL ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          {t('syllabus.sections.previous', 'Previous')}
        </Button>
        <span className="text-xs text-muted-foreground">
          {currentIndex + 1} / {sortedSections.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!nextSection}
          onClick={() => nextSection && onNavigateSection(nextSection.id)}
          className="rounded-full gap-1 h-8"
        >
          {t('syllabus.sections.next', 'Next')}
          {isRTL ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );

  const bottomNavRow = (
    <div className={cn('flex items-center justify-between pt-4', isRTL && 'flex-row-reverse')}>
      <Button
        variant="outline"
        disabled={!prevSection}
        onClick={() => prevSection && onNavigateSection(prevSection.id)}
        className="rounded-full gap-1.5"
      >
        {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        {prevSection?.title || t('syllabus.sections.previous', 'Previous')}
      </Button>
      <Button
        variant="outline"
        disabled={!nextSection}
        onClick={() => nextSection && onNavigateSection(nextSection.id)}
        className="rounded-full gap-1.5"
      >
        {nextSection?.title || t('syllabus.sections.next', 'Next')}
        {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>
    </div>
  );

  if (locked) {
    return (
      <div className="space-y-6">
        {topNavRow}
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">
              {t('syllabus.sections.locked', 'Locked')}
            </h3>
            <p className="text-muted-foreground max-w-md mb-4">
              {t('syllabus.sections.unlockRequirements', 'Complete the required sections to unlock this content.')}
            </p>
          </CardContent>
        </Card>
        {bottomNavRow}
      </div>
    );
  }

  const dateRange = [section.start_date, section.end_date].filter(Boolean).join(' → ');

  return (
    <div className="space-y-6">
      {topNavRow}

      {/* Header */}
      <div>
        <h2 className={cn('text-2xl font-bold text-foreground mb-2', isRTL && 'text-right')}>
          {section.title}
        </h2>
        <div className={cn('flex flex-wrap items-center gap-3', isRTL && 'flex-row-reverse')}>
          {dateRange && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> {dateRange}
            </span>
          )}
          {useFlowList ? (
            <Badge variant="secondary" className="rounded-full text-xs">
              <BookOpen className="h-3 w-3 me-1" /> {orderedFlow.length}{' '}
              {t('syllabus.detail.moduleSteps', 'module steps')}
            </Badge>
          ) : assignments.length > 0 ? (
            <Badge variant="secondary" className="rounded-full text-xs">
              <BookOpen className="h-3 w-3 me-1" /> {assignments.length}{' '}
              {t('syllabus.sections.linkedAssignments', 'assignments')}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Description */}
      {section.description && (
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-5">
            <p className={cn('text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap', isRTL && 'text-right')}>
              {section.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rich content */}
      {section.content && (
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            {t('syllabus.sections.content', 'Content')}
          </h4>
          <RichTextViewer content={section.content} />
        </div>
      )}

      {/* Objectives */}
      {section.objectives && section.objectives.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
            <Target className="h-3 w-3" /> {t('syllabus.detail.objectives', 'Objectives')}
          </h4>
          <div className="space-y-2">
            {section.objectives.map((obj, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/20">
                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                </div>
                <span className="text-sm text-foreground/80">{obj}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module flow (assignments + activities) or linked assignments only */}
      {(useFlowList || assignments.length > 0) && (
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
            <BookOpen className="h-3 w-3" />{' '}
            {useFlowList
              ? t('syllabus.detail.moduleStepsHeading', 'Module steps')
              : t('syllabus.detail.linkedAssignments', 'Assignments')}
          </h4>
          {moduleProgressStats.total > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{t('syllabus.progress.moduleProgress', 'Module progress')}</span>
                <span>
                  {moduleProgressStats.done} / {moduleProgressStats.total}
                </span>
              </div>
              <Progress value={moduleProgressStats.percent} className="h-2" />
            </div>
          )}
          <div className="space-y-1.5">
            {useFlowList
              ? orderedFlow.map((step) => {
                  if (step.step_kind === 'resource' && step.activity_list_id) {
                    const r = resourceById[step.activity_list_id];
                    const title =
                      r?.title ?? t('studentClassroom.activities.activity', 'Activity');
                    const sub = t('syllabus.detail.activityStepLabel', 'Activity');
                    return (
                      <Link
                        key={step.id}
                        to={`/student/classroom/${classroomId}/activity/${step.activity_list_id}`}
                        state={{ returnClassroomSection: 'outline' }}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card/50',
                          'hover:bg-muted/60 transition-colors cursor-pointer text-foreground no-underline',
                          isRTL && 'flex-row-reverse',
                        )}
                      >
                        <div className="p-1.5 rounded-md bg-muted/50">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                          <span className="text-sm font-medium text-foreground truncate block">
                            {title}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{sub}</span>
                        </div>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-medium flex-shrink-0',
                            isRTL && 'flex-row-reverse',
                          )}
                        >
                          <ExternalLink className="h-3 w-3" />
                          {t('syllabus.resources.open')}
                        </span>
                      </Link>
                    );
                  }
                  if (step.step_kind === 'assignment' && step.assignment_id) {
                    const a = assignmentById[step.assignment_id];
                    if (!a) return null;
                    return (
                      <Link
                        key={step.id}
                        to={`/student/assignment/${a.id}`}
                        state={{ returnClassroomSection: 'curriculum' }}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card/50',
                          'hover:bg-muted/60 transition-colors cursor-pointer text-foreground no-underline',
                          isRTL && 'flex-row-reverse',
                        )}
                      >
                        <div className="p-1.5 rounded-md bg-muted/50">
                          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                          <span className="text-sm font-medium text-foreground truncate block">
                            {a.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{a.type}</span>
                        </div>
                        {a.due_at && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 flex-shrink-0">
                            <Calendar className="h-3 w-3" />
                            {new Date(a.due_at).toLocaleDateString()}
                          </span>
                        )}
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-medium flex-shrink-0',
                            isRTL && 'flex-row-reverse',
                          )}
                        >
                          <ExternalLink className="h-3 w-3" />
                          {t('syllabus.resources.open')}
                        </span>
                      </Link>
                    );
                  }
                  return null;
                })
              : assignments.map((a) => (
                  <Link
                    key={a.id}
                    to={`/student/assignment/${a.id}`}
                    state={{ returnClassroomSection: 'curriculum' }}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card/50',
                      'hover:bg-muted/60 transition-colors cursor-pointer text-foreground no-underline',
                      isRTL && 'flex-row-reverse',
                    )}
                  >
                    <div className="p-1.5 rounded-md bg-muted/50">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <span className="text-sm font-medium text-foreground truncate block">{a.title}</span>
                      <span className="text-[10px] text-muted-foreground">{a.type}</span>
                    </div>
                    {a.due_at && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 flex-shrink-0">
                        <Calendar className="h-3 w-3" />
                        {new Date(a.due_at).toLocaleDateString()}
                      </span>
                    )}
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-medium flex-shrink-0',
                        isRTL && 'flex-row-reverse',
                      )}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t('syllabus.resources.open')}
                    </span>
                  </Link>
                ))}
          </div>
        </div>
      )}

      {bottomNavRow}
    </div>
  );
};
