import { useMemo, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Loader2,
  Lock,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  PlayCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import {
  useSyllabus,
  useClassroomAssignments,
  useStudentProgress,
  useStudentCurriculumFlowContext,
} from '@/hooks/queries';
import { useNotifications } from '@/hooks/queries/useNotificationQueries';
import { useModuleFlowStepsBulk } from '@/hooks/queries/useModuleFlowQueries';
import { isSectionUnlocked, type SectionSequentialUnlockFlow } from '@/lib/sectionUnlock';
import {
  computeDefaultModuleFlow,
  getOrderedActivityCenterFlowSteps,
  type AssignmentRow,
} from '@/lib/moduleFlow';
import {
  persistedStepVisualState,
  computedStepVisualState,
  firstIncompleteActionablePersistedIndex,
  firstIncompleteActionableComputedIndex,
  isAssignmentMissedDeadline,
  isSectionActivityFlowFullyComplete,
} from '@/lib/moduleFlowStudent';
import { cn } from '@/lib/utils';
import type { FlowStepTarget } from '@/lib/moduleFlowNavigation';
import type { ReleaseMode, StudentProgressStatus, SyllabusSection } from '@/types/syllabus';
import { StudentModuleOutlineRail } from './StudentModuleOutlineRail';

type FlowStepVisual = 'locked' | 'available' | 'done' | 'missed_deadline';

function flowStepRowIsActiveHighlight(
  resumeHighlight: boolean,
  isNextUp: boolean,
  visual: FlowStepVisual,
): boolean {
  if (visual === 'missed_deadline') return false;
  return resumeHighlight || isNextUp;
}

function flowStepRowInnerClass(
  isRTL: boolean,
  isActiveHighlight: boolean,
  visual: FlowStepVisual,
): string {
  return cn(
    'flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-md',
    isRTL && 'flex-row-reverse',
    isActiveHighlight && 'border-s-4 border-primary bg-primary/[0.07] py-1.5 ps-3 pe-2',
    visual === 'missed_deadline' &&
      'border border-amber-500/40 bg-amber-500/[0.06] px-1.5 py-0.5',
  );
}

function flowStepRowAriaSuffix(
  resumeHighlight: boolean,
  isActiveHighlight: boolean,
  translate: (key: string) => string,
): string {
  if (resumeHighlight) return translate('studentClassroom.activities.stepRowAria.resume');
  if (isActiveHighlight) return translate('studentClassroom.activities.stepRowAria.next');
  return '';
}

function FlowStepNumberCell({
  stepNumber,
  isRTL,
  showPointer,
}: {
  stepNumber: number;
  isRTL: boolean;
  showPointer: boolean;
}) {
  return (
    <span
      className={cn(
        'flex min-w-[2.25rem] shrink-0 items-center gap-0.5 tabular-nums text-sm font-medium text-muted-foreground',
        isRTL ? 'flex-row-reverse text-start' : 'flex-row text-end',
      )}
    >
      {showPointer ? (
        <ChevronRight
          className={cn('h-3.5 w-3.5 shrink-0 text-primary', isRTL && 'rotate-180')}
          aria-hidden
        />
      ) : (
        <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      <span>{stepNumber}.</span>
    </span>
  );
}

interface StudentActivitiesSectionProps {
  classroomId: string;
  isRTL: boolean;
  /** Highlights the step matching the About page Continue target. */
  resumeTarget?: FlowStepTarget | null;
  resumeSectionId?: string | null;
  /** Same as legacy Course Outline row: open full module study page (SectionContentPage). */
  onOpenModuleFullPage?: (sectionId: string) => void;
  /** When set (e.g. teacher viewing a student), progress reflects this user instead of the signed-in student. */
  progressUserId?: string;
  /** No navigation into student routes; step labels are plain text. */
  readOnly?: boolean;
}

export function StudentActivitiesSection({
  classroomId,
  isRTL,
  resumeTarget = null,
  resumeSectionId = null,
  onOpenModuleFullPage,
  progressUserId: progressUserIdProp,
  readOnly = false,
}: StudentActivitiesSectionProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const effectiveProgressUserId = progressUserIdProp ?? user?.id;
  const ownsProgressView = !readOnly && effectiveProgressUserId === user?.id;
  const { data: unreadNotifications = [] } = useNotifications(
    ownsProgressView ? user?.id : undefined,
  );
  const { data: syllabus, isLoading: syllabusLoading } = useSyllabus(classroomId);
  const { data: assignments = [] } = useClassroomAssignments(classroomId);
  const { data: studentProgressData } = useStudentProgress(syllabus?.id, effectiveProgressUserId);

  const studentProgressMap = useMemo(() => {
    const map: Record<string, StudentProgressStatus> = {};
    (studentProgressData ?? []).forEach((p) => {
      map[p.section_id] = p.status;
    });
    return map;
  }, [studentProgressData]);

  const sections = useMemo(() => {
    const list = syllabus?.sections ?? [];
    return [...list].sort((a, b) => a.order_index - b.order_index);
  }, [syllabus?.sections]);

  const releaseMode: ReleaseMode = syllabus?.release_mode ?? 'all_at_once';

  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);
  const { data: flowBulk = {}, isLoading: flowLoading } = useModuleFlowStepsBulk(sectionIds);

  const resourceMap = syllabus?.section_resources ?? {};

  const assignRows = assignments as AssignmentRow[];

  const classroomAssignmentIdSet = useMemo(
    () => new Set(assignRows.map((a) => a.id)),
    [assignRows],
  );

  const newAttemptAssignmentIdSet = useMemo(() => {
    const set = new Set<string>();
    if (!ownsProgressView) return set;
    for (const n of unreadNotifications) {
      if (n.type !== 'assignment_new_attempt') continue;
      const aid = n.metadata?.assignment_id;
      if (typeof aid !== 'string' || !classroomAssignmentIdSet.has(aid)) continue;
      const metaClassroom = n.metadata?.classroom_id;
      if (metaClassroom != null && metaClassroom !== classroomId) continue;
      set.add(aid);
    }
    return set;
  }, [ownsProgressView, unreadNotifications, classroomAssignmentIdSet, classroomId]);

  const flowContextEnabled = Boolean(
    effectiveProgressUserId && (progressUserIdProp ? !!syllabus : true),
  );

  const { flowCtx, isLoadingProgress: curriculumFlowProgressLoading } = useStudentCurriculumFlowContext({
    userId: effectiveProgressUserId,
    sectionIds,
    flowBulk,
    resourceMap,
    assignments: assignRows,
    enabled: flowContextEnabled,
  });

  const flowNow = new Date();
  const flowAccessMeta = { assignments: assignRows, now: flowNow };

  const sequentialUnlockFlow = useMemo<SectionSequentialUnlockFlow | null>(() => {
    if (!effectiveProgressUserId) return null;
    return {
      flowBulk,
      resourceMap,
      assignments: assignRows,
      flowCtx,
      now: new Date(),
    };
  }, [effectiveProgressUserId, flowBulk, resourceMap, assignRows, flowCtx]);

  const [moduleOpenById, setModuleOpenById] = useState<Record<string, boolean>>({});
  const [hideFinished, setHideFinished] = useState(true);
  const prevClassroomIdRef = useRef(classroomId);
  const prevProgressUserKeyRef = useRef(progressUserIdProp ?? '');

  const isUnitFinished = useMemo(() => {
    return (section: SyllabusSection) => {
      const unlocked = isSectionUnlocked(
        section,
        sections,
        releaseMode,
        studentProgressMap,
        sequentialUnlockFlow,
      );
      const progressState = studentProgressMap[section.id];
      const persisted = flowBulk[section.id] ?? [];
      const sectionResources = resourceMap[section.id] ?? [];
      const flowComplete = isSectionActivityFlowFullyComplete(
        section.id,
        persisted,
        sectionResources,
        assignRows,
        flowCtx,
        new Date(),
      );
      const showFlowCheck = unlocked && flowComplete;
      return progressState === 'completed' || showFlowCheck;
    };
  }, [
    sections,
    releaseMode,
    studentProgressMap,
    flowBulk,
    resourceMap,
    assignRows,
    flowCtx,
    sequentialUnlockFlow,
  ]);

  const visibleSections = useMemo(() => {
    if (!hideFinished) return sections;
    return sections.filter((s) => {
      if (!isUnitFinished(s)) return true;
      return resumeSectionId === s.id;
    });
  }, [sections, hideFinished, resumeSectionId, isUnitFinished]);

  useEffect(() => {
    if (sections.length === 0) return;
    const switchedClassroom = prevClassroomIdRef.current !== classroomId;
    const progressKey = progressUserIdProp ?? '';
    const switchedProgressSubject = prevProgressUserKeyRef.current !== progressKey;
    prevClassroomIdRef.current = classroomId;
    prevProgressUserKeyRef.current = progressKey;
    const resetOpen = switchedClassroom || switchedProgressSubject;
    setModuleOpenById((prev) => {
      const next: Record<string, boolean> = {};
      for (const s of sections) {
        next[s.id] = resetOpen ? true : (prev[s.id] ?? true);
      }
      const sameKeys =
        Object.keys(next).length === Object.keys(prev).length &&
        Object.keys(next).every((id) => prev[id] === next[id]);
      return sameKeys && !resetOpen ? prev : next;
    });
  }, [classroomId, sections, progressUserIdProp]);

  const allSectionsOpen = useMemo(
    () =>
      visibleSections.length > 0 &&
      visibleSections.every((s) => moduleOpenById[s.id] === true),
    [visibleSections, moduleOpenById],
  );

  if (syllabusLoading || flowLoading || (flowContextEnabled && curriculumFlowProgressLoading)) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!syllabus) return null;

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div
        className={cn(
          'flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
          isRTL && 'sm:flex-row-reverse',
        )}
      >
        <div className={cn('min-w-0 flex-1', isRTL && 'text-right')}>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            {t('classroomDetail.curriculum.title')}
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm md:text-base">
            {t('classroomDetail.curriculum.subtitle')}
          </p>
        </div>
        <div
          className={cn(
            'flex flex-wrap items-center gap-3 sm:justify-end',
            isRTL && 'sm:flex-row-reverse',
            isRTL ? 'ps-14 md:ps-[5.75rem]' : 'pe-14 md:pe-[5.75rem]',
          )}
        >
          <div
            className={cn(
              'flex min-w-0 max-w-full items-center gap-3 py-1',
              isRTL ? 'flex-row-reverse' : 'flex-row',
            )}
          >
            <Label
              htmlFor="curriculum-show-completed"
              className="cursor-pointer flex-1 text-left text-sm font-medium text-foreground leading-snug sm:flex-none sm:whitespace-nowrap sm:pe-1 rtl:text-right"
            >
              {t('classroomDetail.curriculum.showCompletedUnits')}
            </Label>
            <Switch
              id="curriculum-show-completed"
              variant="ios"
              checked={!hideFinished}
              onCheckedChange={(v) => setHideFinished(!v)}
              aria-label={t('classroomDetail.curriculum.showCompletedUnitsAria')}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="default"
            className="shrink-0 whitespace-nowrap"
            disabled={visibleSections.length === 0}
            onClick={() => {
              if (allSectionsOpen) {
                setModuleOpenById((prev) => {
                  const next = { ...prev };
                  for (const s of visibleSections) next[s.id] = false;
                  return next;
                });
              } else {
                setModuleOpenById((prev) => {
                  const next = { ...prev };
                  for (const s of visibleSections) next[s.id] = true;
                  return next;
                });
              }
            }}
          >
            {allSectionsOpen
              ? t('classroomDetail.curriculum.collapseAll')
              : t('classroomDetail.curriculum.expandAll')}
          </Button>
        </div>
      </div>

      {visibleSections.map((section) => {
        const flowStepIndex = sections.findIndex((s) => s.id === section.id);
        const unlocked = isSectionUnlocked(
          section,
          sections,
          releaseMode,
          studentProgressMap,
          sequentialUnlockFlow,
        );
        const progressState = studentProgressMap[section.id];
        const persisted = flowBulk[section.id] ?? [];
        const sectionResources = resourceMap[section.id] ?? [];
        const flowComplete = isSectionActivityFlowFullyComplete(
          section.id,
          persisted,
          sectionResources,
          assignRows,
          flowCtx,
          flowNow,
        );
        const showFlowCheck = unlocked && flowComplete;
        const highlightInProgress =
          (progressState === 'in_progress' || progressState === 'reviewed') &&
          !showFlowCheck &&
          unlocked;
        const orderedPersisted = getOrderedActivityCenterFlowSteps(persisted, sectionResources);
        const computed = computeDefaultModuleFlow(section.id, sectionResources, assignRows);

        const usePersisted = orderedPersisted.length > 0;
        const steps = usePersisted ? orderedPersisted : null;
        const stepCount = steps ? steps.length : computed.length;
        const open = moduleOpenById[section.id] ?? false;
        const desc = section.description?.trim() ?? '';

        const stepSummary =
          stepCount === 0
            ? t('classroomDetail.activities.emptyModuleSummary')
            : stepCount === 1
              ? t('classroomDetail.activities.stepCountOne')
              : t('classroomDetail.activities.stepCountMany', { count: stepCount });

        const hasStepOutline = Boolean(
          (usePersisted && steps && steps.length > 0) || (!usePersisted && computed.length > 0),
        );
        const showLockedStepPreview = !unlocked && hasStepOutline;

        return (
          <Collapsible
            key={section.id}
            open={open}
            onOpenChange={(next) =>
              setModuleOpenById((prev) => ({ ...prev, [section.id]: next }))
            }
            className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
          >
            <div className={cn('flex min-w-0', isRTL ? 'flex-row-reverse' : 'flex-row')}>
              <StudentModuleOutlineRail
                flowStepIndex={flowStepIndex}
                showFlowCheck={showFlowCheck}
                highlightInProgress={highlightInProgress}
                unlocked={unlocked}
                isRTL={isRTL}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <div
                  className={cn(
                    'flex min-w-0 items-start gap-1 border-b border-transparent px-2 py-3 sm:px-3 sm:pe-2',
                    open && 'border-border/60',
                    isRTL && 'flex-row-reverse',
                  )}
                >
                  <CollapsibleTrigger
                    className={cn(
                      'flex min-w-0 flex-1 items-start gap-2 rounded-md py-1 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      isRTL && 'flex-row-reverse text-end',
                    )}
                  >
                    <ChevronDown
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                        open && 'rotate-180',
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div
                        className={cn(
                          'flex flex-wrap items-center gap-2',
                          isRTL && 'flex-row-reverse justify-end',
                        )}
                      >
                        <h3 className="text-base font-semibold leading-snug text-foreground">{section.title}</h3>
                        {!unlocked ? (
                          <Badge variant="secondary" className="rounded-full gap-1">
                            <Lock className="h-3 w-3" />
                            {t('studentClassroom.activities.moduleLocked')}
                          </Badge>
                        ) : null}
                      </div>
                      {desc ? (
                        <p
                          className={cn(
                            'text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap',
                            isRTL && 'text-right',
                          )}
                        >
                          {desc}
                        </p>
                      ) : null}
                      <p className={cn('text-xs text-muted-foreground', isRTL && 'text-right')}>{stepSummary}</p>
                    </div>
                  </CollapsibleTrigger>
                  {onOpenModuleFullPage && unlocked && !readOnly ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-0.5 h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={t('syllabus.moduleAccordion.openModulePage', {
                        title: section.title,
                      })}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenModuleFullPage(section.id);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>

            <CollapsibleContent>
              <div className="space-y-2 px-3 pb-4 pt-1 sm:px-4">
              {showLockedStepPreview ? (
                <>
                  <p className="mb-2 text-sm text-muted-foreground">
                    {t('studentClassroom.activities.unlockHint')}
                  </p>
                  {usePersisted && steps ? (
                    <ol className="list-none space-y-2">
                      {steps.map((step, index) => {
                        if (step.step_kind === 'resource' && step.activity_list_id) {
                          const label =
                            resourceMap[section.id]?.find((r) => r.id === step.activity_list_id)?.title ??
                            t('studentClassroom.activities.activity');
                          const rowAria = `${label}. ${t('studentClassroom.activities.stepA11y.locked')}. ${t('studentClassroom.activities.moduleLocked')}`;
                          return (
                            <li key={step.id} className="flex min-w-0 items-center gap-2 text-sm">
                              <FlowStepNumberCell
                                stepNumber={index + 1}
                                isRTL={isRTL}
                                showPointer={false}
                              />
                              <div
                                className={flowStepRowInnerClass(isRTL, false, 'locked')}
                                aria-label={rowAria}
                              >
                                <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="text-muted-foreground">{label}</span>
                              </div>
                            </li>
                          );
                        }
                        if (step.step_kind === 'assignment' && step.assignment_id) {
                          const a = (assignments as { id: string; title: string }[]).find(
                            (x) => x.id === step.assignment_id,
                          );
                          const label = a?.title ?? t('studentClassroom.activities.assignment');
                          const rowAria = `${label}. ${t('studentClassroom.activities.stepA11y.locked')}. ${t('studentClassroom.activities.moduleLocked')}`;
                          return (
                            <li key={step.id} className="flex min-w-0 items-center gap-2 text-sm">
                              <FlowStepNumberCell
                                stepNumber={index + 1}
                                isRTL={isRTL}
                                showPointer={false}
                              />
                              <div
                                className={flowStepRowInnerClass(isRTL, false, 'locked')}
                                aria-label={rowAria}
                              >
                                <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                                <ClipboardList className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="text-muted-foreground">{label}</span>
                              </div>
                            </li>
                          );
                        }
                        return null;
                      })}
                    </ol>
                  ) : (
                    <ol className="list-none space-y-2">
                      {computed.map((c, idx) => {
                        if (c.kind === 'resource') {
                          const r = resourceMap[section.id]?.find((x) => x.id === c.activity_list_id);
                          const label = r?.title ?? t('studentClassroom.activities.activity');
                          const rowAria = `${label}. ${t('studentClassroom.activities.stepA11y.locked')}. ${t('studentClassroom.activities.moduleLocked')}`;
                          return (
                            <li
                              key={`locked-r-${c.activity_list_id}-${idx}`}
                              className="flex min-w-0 items-center gap-2 text-sm"
                            >
                              <FlowStepNumberCell stepNumber={idx + 1} isRTL={isRTL} showPointer={false} />
                              <div
                                className={flowStepRowInnerClass(isRTL, false, 'locked')}
                                aria-label={rowAria}
                              >
                                <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="text-muted-foreground">{label}</span>
                              </div>
                            </li>
                          );
                        }
                        const a = (assignments as { id: string; title: string }[]).find(
                          (x) => x.id === c.assignment_id,
                        );
                        const label = a?.title ?? t('studentClassroom.activities.assignment');
                        const rowAria = `${label}. ${t('studentClassroom.activities.stepA11y.locked')}. ${t('studentClassroom.activities.moduleLocked')}`;
                        return (
                          <li
                            key={`locked-a-${c.assignment_id}-${idx}`}
                            className="flex min-w-0 items-center gap-2 text-sm"
                          >
                            <FlowStepNumberCell stepNumber={idx + 1} isRTL={isRTL} showPointer={false} />
                            <div
                              className={flowStepRowInnerClass(isRTL, false, 'locked')}
                              aria-label={rowAria}
                            >
                              <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                              <ClipboardList className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                              <span className="text-muted-foreground">{label}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </>
              ) : !unlocked ? (
                <p className="text-sm text-muted-foreground">{t('studentClassroom.activities.unlockHint')}</p>
              ) : usePersisted && steps ? (
                <ol className="list-none space-y-2">
                  {(() => {
                    const nextIdx = firstIncompleteActionablePersistedIndex(
                      steps,
                      flowCtx,
                      assignRows,
                      flowNow,
                    );
                    return steps.map((step, index) => {
                      const baseVisual = persistedStepVisualState(step, steps, index, flowCtx, flowAccessMeta);
                      const missedAssignment =
                        step.step_kind === 'assignment' &&
                        step.assignment_id &&
                        isAssignmentMissedDeadline(step.assignment_id, assignRows, flowCtx, flowNow);
                      const visual = missedAssignment ? 'missed_deadline' : baseVisual;
                      const locked = visual === 'locked' || visual === 'missed_deadline';
                      const isNextUp = nextIdx === index && visual === 'available';
                      const statusLabel =
                        visual === 'missed_deadline'
                          ? t('studentClassroom.activities.stepA11y.missed_deadline')
                          : t(`studentClassroom.activities.stepA11y.${visual}`);

                      if (step.step_kind === 'resource' && step.activity_list_id) {
                        const label =
                          resourceMap[section.id]?.find((r) => r.id === step.activity_list_id)?.title ??
                          t('studentClassroom.activities.activity');
                        const resumeHighlight =
                          Boolean(
                            resumeTarget &&
                              resumeSectionId === section.id &&
                              resumeTarget.kind === 'resource' &&
                              resumeTarget.id === step.activity_list_id,
                          );
                        const isActiveHighlight = flowStepRowIsActiveHighlight(
                          resumeHighlight,
                          isNextUp,
                          visual,
                        );
                        const ariaSuffix = flowStepRowAriaSuffix(
                          resumeHighlight,
                          isActiveHighlight,
                          t,
                        );
                        const rowAria = ariaSuffix
                          ? `${label}. ${statusLabel} ${ariaSuffix}`
                          : `${label}. ${statusLabel}`;
                        const showResumeBadge = resumeHighlight && visual !== 'missed_deadline';
                        return (
                          <li
                            key={step.id}
                            className="flex min-w-0 items-center gap-2 text-sm"
                            {...(isActiveHighlight ? { 'aria-current': 'step' as const } : {})}
                          >
                            <FlowStepNumberCell
                              stepNumber={index + 1}
                              isRTL={isRTL}
                              showPointer={isActiveHighlight}
                            />
                            <div
                              className={flowStepRowInnerClass(isRTL, isActiveHighlight, visual)}
                              aria-label={rowAria}
                            >
                              {visual === 'missed_deadline' ? (
                                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0" aria-hidden />
                              ) : visual === 'locked' ? (
                                <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                              ) : visual === 'done' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" aria-hidden />
                              ) : isNextUp ? (
                                <PlayCircle className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                              )}
                              {locked ? (
                                <span className="text-muted-foreground">{label}</span>
                              ) : readOnly ? (
                                <span
                                  className={cn(
                                    'inline-flex max-w-full items-center gap-1 font-medium text-foreground',
                                    isActiveHighlight && 'font-semibold',
                                  )}
                                >
                                  <FileText className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </span>
                              ) : (
                                <Link
                                  to={`/student/classroom/${classroomId}/activity/${step.activity_list_id}`}
                                  state={{ returnClassroomSection: 'curriculum' }}
                                  className={cn(
                                    'inline-flex max-w-full items-center gap-1 font-medium text-primary hover:underline',
                                    isActiveHighlight && 'font-semibold',
                                  )}
                                >
                                  <FileText className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </Link>
                              )}
                              {showResumeBadge ? (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 rounded-full border-primary/35 bg-primary/[0.06] px-2 py-0 text-[10px] font-semibold text-primary"
                                >
                                  {t('studentClassroom.activities.resumeStepBadge')}
                                </Badge>
                              ) : null}
                            </div>
                          </li>
                        );
                      }

                      if (step.step_kind === 'assignment' && step.assignment_id) {
                        const a = (assignments as { id: string; title: string }[]).find((x) => x.id === step.assignment_id);
                        const assignmentUnavailable = !a;
                        const label = a?.title ?? t('studentClassroom.activities.assignment');
                        const displayLabel = assignmentUnavailable
                          ? t('studentClassroom.activities.assignmentUnavailable')
                          : label;
                        const resumeHighlight =
                          Boolean(
                            resumeTarget &&
                              resumeSectionId === section.id &&
                              resumeTarget.kind === 'assignment' &&
                              resumeTarget.id === step.assignment_id,
                          ) && !missedAssignment;
                        const isActiveHighlight = flowStepRowIsActiveHighlight(
                          resumeHighlight,
                          isNextUp,
                          visual,
                        );
                        const ariaSuffix = flowStepRowAriaSuffix(
                          resumeHighlight,
                          isActiveHighlight,
                          t,
                        );
                        const rowAria = ariaSuffix
                          ? `${displayLabel}. ${statusLabel} ${ariaSuffix}`
                          : `${displayLabel}. ${statusLabel}`;
                        const showResumeBadge = resumeHighlight && visual !== 'missed_deadline';
                        const showNewAttemptBadge = newAttemptAssignmentIdSet.has(step.assignment_id);
                        return (
                          <li
                            key={step.id}
                            className="flex min-w-0 items-center gap-2 text-sm"
                            {...(isActiveHighlight ? { 'aria-current': 'step' as const } : {})}
                          >
                            <FlowStepNumberCell
                              stepNumber={index + 1}
                              isRTL={isRTL}
                              showPointer={isActiveHighlight}
                            />
                            <div
                              className={flowStepRowInnerClass(isRTL, isActiveHighlight, visual)}
                              aria-label={rowAria}
                            >
                              {visual === 'missed_deadline' ? (
                                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0" aria-hidden />
                              ) : visual === 'locked' ? (
                                <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                              ) : visual === 'done' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" aria-hidden />
                              ) : isNextUp ? (
                                <PlayCircle className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                              )}
                              {locked || assignmentUnavailable ? (
                                visual === 'missed_deadline' ? (
                                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                    <span className="text-muted-foreground">{displayLabel}</span>
                                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                      {t('studentClassroom.activities.pastDueNoAttempt')}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">{displayLabel}</span>
                                )
                              ) : readOnly ? (
                                <span
                                  className={cn(
                                    'inline-flex h-auto min-h-0 max-w-full items-center gap-1 text-base font-medium text-foreground',
                                    isActiveHighlight && 'font-semibold',
                                  )}
                                >
                                  <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </span>
                              ) : (
                                <Link
                                  to={`/student/assignment/${step.assignment_id}`}
                                  state={{ returnClassroomSection: 'curriculum' }}
                                  className={cn(
                                    buttonVariants({ variant: 'link', size: 'default' }),
                                    'inline-flex h-auto min-h-0 max-w-full items-center gap-1 p-0 text-base',
                                    isActiveHighlight && 'font-semibold',
                                  )}
                                >
                                  <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </Link>
                              )}
                              {showResumeBadge ? (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 rounded-full border-primary/35 bg-primary/[0.06] px-2 py-0 text-[10px] font-semibold text-primary"
                                >
                                  {t('studentClassroom.activities.resumeStepBadge')}
                                </Badge>
                              ) : null}
                              {showNewAttemptBadge ? (
                                <Badge
                                  variant="secondary"
                                  className="shrink-0 rounded-full px-2 py-0 text-[10px] font-semibold"
                                >
                                  {t('notifications.newAttempt.badge')}
                                </Badge>
                              ) : null}
                            </div>
                          </li>
                        );
                      }
                      return null;
                    });
                  })()}
                </ol>
              ) : computed.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{t('studentClassroom.activities.fallbackFlowHint')}</p>
                  <ol className="list-none space-y-2">
                    {(() => {
                      const nextIdx = firstIncompleteActionableComputedIndex(
                        computed,
                        flowCtx,
                        assignRows,
                        flowNow,
                      );
                      return computed.map((c, idx) => {
                        const baseVisual = computedStepVisualState(c, computed, idx, flowCtx, flowAccessMeta);
                        const missedAssignment =
                          c.kind === 'assignment' &&
                          isAssignmentMissedDeadline(c.assignment_id, assignRows, flowCtx, flowNow);
                        const visual = missedAssignment ? 'missed_deadline' : baseVisual;
                        const locked = visual === 'locked' || visual === 'missed_deadline';
                        const isNextUp = nextIdx === idx && visual === 'available';
                        const statusLabel =
                          visual === 'missed_deadline'
                            ? t('studentClassroom.activities.stepA11y.missed_deadline')
                            : t(`studentClassroom.activities.stepA11y.${visual}`);

                        if (c.kind === 'resource') {
                          const r = resourceMap[section.id]?.find((x) => x.id === c.activity_list_id);
                          const label = r?.title ?? t('studentClassroom.activities.activity');
                          const resumeHighlight =
                            Boolean(
                              resumeTarget &&
                                resumeSectionId === section.id &&
                                resumeTarget.kind === 'resource' &&
                                c.activity_list_id &&
                                resumeTarget.id === c.activity_list_id,
                            );
                          const isActiveHighlight = flowStepRowIsActiveHighlight(
                            resumeHighlight,
                            isNextUp,
                            visual,
                          );
                          const ariaSuffix = flowStepRowAriaSuffix(
                            resumeHighlight,
                            isActiveHighlight,
                            t,
                          );
                          const rowAria = ariaSuffix
                            ? `${label}. ${statusLabel} ${ariaSuffix}`
                            : `${label}. ${statusLabel}`;
                          const showResumeBadge = resumeHighlight && visual !== 'missed_deadline';
                          return (
                            <li
                              key={`r-${c.activity_list_id}-${idx}`}
                              className="flex min-w-0 items-center gap-2 text-sm"
                              {...(isActiveHighlight ? { 'aria-current': 'step' as const } : {})}
                            >
                              <FlowStepNumberCell
                                stepNumber={idx + 1}
                                isRTL={isRTL}
                                showPointer={isActiveHighlight}
                              />
                              <div
                                className={flowStepRowInnerClass(isRTL, isActiveHighlight, visual)}
                                aria-label={rowAria}
                              >
                                {visual === 'missed_deadline' ? (
                                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0" aria-hidden />
                                ) : visual === 'locked' ? (
                                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                                ) : visual === 'done' ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" aria-hidden />
                                ) : isNextUp ? (
                                  <PlayCircle className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
                                ) : (
                                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                                )}
                                {locked ? (
                                  <span className="text-muted-foreground">{label}</span>
                                ) : readOnly ? (
                                  <span
                                    className={cn(
                                      'inline-flex max-w-full items-center gap-1 font-medium text-foreground',
                                      isActiveHighlight && 'font-semibold',
                                    )}
                                  >
                                    <FileText className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{label}</span>
                                  </span>
                                ) : (
                                  <Link
                                    to={`/student/classroom/${classroomId}/activity/${c.activity_list_id}`}
                                    state={{ returnClassroomSection: 'curriculum' }}
                                    className={cn(
                                      'inline-flex max-w-full items-center gap-1 font-medium text-primary hover:underline',
                                      isActiveHighlight && 'font-semibold',
                                    )}
                                  >
                                    <FileText className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{label}</span>
                                  </Link>
                                )}
                                {showResumeBadge ? (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 rounded-full border-primary/35 bg-primary/[0.06] px-2 py-0 text-[10px] font-semibold text-primary"
                                  >
                                    {t('studentClassroom.activities.resumeStepBadge')}
                                  </Badge>
                                ) : null}
                              </div>
                            </li>
                          );
                        }
                        const a = (assignments as { id: string; title: string }[]).find((x) => x.id === c.assignment_id);
                        const assignmentUnavailable = !a;
                        const label = a?.title ?? t('studentClassroom.activities.assignment');
                        const displayLabel = assignmentUnavailable
                          ? t('studentClassroom.activities.assignmentUnavailable')
                          : label;
                        const resumeHighlight =
                          Boolean(
                            resumeTarget &&
                              resumeSectionId === section.id &&
                              resumeTarget.kind === 'assignment' &&
                              c.assignment_id &&
                              resumeTarget.id === c.assignment_id,
                          ) && !missedAssignment;
                        const isActiveHighlight = flowStepRowIsActiveHighlight(
                          resumeHighlight,
                          isNextUp,
                          visual,
                        );
                        const ariaSuffix = flowStepRowAriaSuffix(
                          resumeHighlight,
                          isActiveHighlight,
                          t,
                        );
                        const rowAria = ariaSuffix
                          ? `${displayLabel}. ${statusLabel} ${ariaSuffix}`
                          : `${displayLabel}. ${statusLabel}`;
                        const showResumeBadge = resumeHighlight && visual !== 'missed_deadline';
                        const showNewAttemptBadge = Boolean(
                          c.assignment_id && newAttemptAssignmentIdSet.has(c.assignment_id),
                        );
                        return (
                          <li
                            key={`a-${c.assignment_id}-${idx}`}
                            className="flex min-w-0 items-center gap-2 text-sm"
                            {...(isActiveHighlight ? { 'aria-current': 'step' as const } : {})}
                          >
                            <FlowStepNumberCell
                              stepNumber={idx + 1}
                              isRTL={isRTL}
                              showPointer={isActiveHighlight}
                            />
                            <div
                              className={flowStepRowInnerClass(isRTL, isActiveHighlight, visual)}
                              aria-label={rowAria}
                            >
                              {visual === 'missed_deadline' ? (
                                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0" aria-hidden />
                              ) : visual === 'locked' ? (
                                <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                              ) : visual === 'done' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" aria-hidden />
                              ) : isNextUp ? (
                                <PlayCircle className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                              )}
                              {locked || assignmentUnavailable ? (
                                visual === 'missed_deadline' ? (
                                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                    <span className="text-muted-foreground">{displayLabel}</span>
                                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                      {t('studentClassroom.activities.pastDueNoAttempt')}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">{displayLabel}</span>
                                )
                              ) : readOnly ? (
                                <span
                                  className={cn(
                                    'inline-flex h-auto min-h-0 max-w-full items-center gap-1 text-base font-medium text-foreground',
                                    isActiveHighlight && 'font-semibold',
                                  )}
                                >
                                  <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </span>
                              ) : (
                                <Link
                                  to={`/student/assignment/${c.assignment_id}`}
                                  state={{ returnClassroomSection: 'curriculum' }}
                                  className={cn(
                                    buttonVariants({ variant: 'link', size: 'default' }),
                                    'inline-flex h-auto min-h-0 max-w-full items-center gap-1 p-0 text-base',
                                    isActiveHighlight && 'font-semibold',
                                  )}
                                >
                                  <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </Link>
                              )}
                              {showResumeBadge ? (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 rounded-full border-primary/35 bg-primary/[0.06] px-2 py-0 text-[10px] font-semibold text-primary"
                                >
                                  {t('studentClassroom.activities.resumeStepBadge')}
                                </Badge>
                              ) : null}
                              {showNewAttemptBadge ? (
                                <Badge
                                  variant="secondary"
                                  className="shrink-0 rounded-full px-2 py-0 text-[10px] font-semibold"
                                >
                                  {t('notifications.newAttempt.badge')}
                                </Badge>
                              ) : null}
                            </div>
                          </li>
                        );
                      });
                    })()}
                  </ol>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('studentClassroom.activities.emptyModule')}</p>
              )}
              </div>
            </CollapsibleContent>
              </div>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
