import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
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
  Eye,
} from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import {
  useSyllabus,
  useClassroomAssignments,
  useStudentProgress,
  useStudentCurriculumFlowContext,
} from '@/hooks/queries';
import { useModuleFlowStepsBulk } from '@/hooks/queries/useModuleFlowQueries';
import { isSectionUnlocked } from '@/lib/sectionUnlock';
import {
  computeDefaultModuleFlow,
  getOrderedActivityCenterFlowSteps,
  type AssignmentRow,
} from '@/lib/moduleFlow';
import {
  persistedStepVisualState,
  computedStepVisualState,
  firstIncompletePersistedIndex,
  firstIncompleteComputedIndex,
  isSectionActivityFlowFullyComplete,
} from '@/lib/moduleFlowStudent';
import { cn } from '@/lib/utils';
import type { ReleaseMode, StudentProgressStatus } from '@/types/syllabus';
import { StudentModuleOutlineRail } from './StudentModuleOutlineRail';

interface StudentActivitiesSectionProps {
  classroomId: string;
  isRTL: boolean;
  /** Same as legacy Course Outline row: open full module study page (SectionContentPage). */
  onOpenModuleFullPage?: (sectionId: string) => void;
}

export function StudentActivitiesSection({
  classroomId,
  isRTL,
  onOpenModuleFullPage,
}: StudentActivitiesSectionProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: syllabus, isLoading: syllabusLoading } = useSyllabus(classroomId);
  const { data: assignments = [] } = useClassroomAssignments(classroomId);
  const { data: studentProgressData } = useStudentProgress(syllabus?.id, user?.id);

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

  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);
  const { data: flowBulk = {}, isLoading: flowLoading } = useModuleFlowStepsBulk(sectionIds);

  const resourceMap = syllabus?.section_resources ?? {};

  const assignRows = assignments as AssignmentRow[];

  const { flowCtx } = useStudentCurriculumFlowContext({
    userId: user?.id,
    sectionIds,
    flowBulk,
    resourceMap,
    assignments: assignRows,
  });

  const [moduleOpenById, setModuleOpenById] = useState<Record<string, boolean>>({});

  const allSectionsOpen = useMemo(
    () =>
      sections.length > 0 && sections.every((s) => moduleOpenById[s.id] === true),
    [sections, moduleOpenById],
  );

  const releaseMode: ReleaseMode = syllabus?.release_mode ?? 'all_at_once';

  if (syllabusLoading || flowLoading) {
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
        <Button
          type="button"
          variant="outline"
          size="default"
          className="shrink-0 whitespace-nowrap"
          disabled={sections.length === 0}
          onClick={() => {
            if (allSectionsOpen) {
              setModuleOpenById((prev) => {
                const next = { ...prev };
                for (const s of sections) next[s.id] = false;
                return next;
              });
            } else {
              setModuleOpenById((prev) => {
                const next = { ...prev };
                for (const s of sections) next[s.id] = true;
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

      {sections.map((section, flowStepIndex) => {
        const unlocked = isSectionUnlocked(section, sections, releaseMode, studentProgressMap);
        const progressState = studentProgressMap[section.id];
        const persisted = flowBulk[section.id] ?? [];
        const sectionResources = resourceMap[section.id] ?? [];
        const flowComplete = isSectionActivityFlowFullyComplete(
          section.id,
          persisted,
          sectionResources,
          assignRows,
          flowCtx,
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
                  {onOpenModuleFullPage && unlocked ? (
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
              {!unlocked ? (
                <p className="text-sm text-muted-foreground">{t('studentClassroom.activities.unlockHint')}</p>
              ) : usePersisted && steps ? (
                <ol className="list-none space-y-2">
                  {(() => {
                    const nextIdx = firstIncompletePersistedIndex(steps, flowCtx);
                    return steps.map((step, index) => {
                      const visual = persistedStepVisualState(step, steps, index, flowCtx);
                      const locked = visual === 'locked';
                      const isNextUp = nextIdx === index && visual === 'available';
                      const statusLabel = t(`studentClassroom.activities.stepA11y.${visual}`);

                      if (step.step_kind === 'resource' && step.activity_list_id) {
                        const label =
                          resourceMap[section.id]?.find((r) => r.id === step.activity_list_id)?.title ??
                          t('studentClassroom.activities.activity');
                        return (
                          <li key={step.id} className="flex min-w-0 items-center gap-2 text-sm">
                            <span
                              className={cn(
                                'shrink-0 min-w-[1.75rem] tabular-nums font-medium text-muted-foreground',
                                isRTL ? 'text-start' : 'text-end',
                              )}
                            >
                              {index + 1}.
                            </span>
                            <div
                              className={cn(
                                'flex min-w-0 flex-1 flex-wrap items-center gap-2',
                                isRTL && 'flex-row-reverse',
                              )}
                              aria-label={`${label}. ${statusLabel}`}
                            >
                              {visual === 'locked' ? (
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
                              ) : (
                                <Link
                                  to={`/student/classroom/${classroomId}/activity/${step.activity_list_id}`}
                                  state={{ returnClassroomSection: 'curriculum' }}
                                  className="inline-flex max-w-full items-center gap-1 font-medium text-primary hover:underline"
                                >
                                  <FileText className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </Link>
                              )}
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
                        return (
                          <li key={step.id} className="flex min-w-0 items-center gap-2 text-sm">
                            <span
                              className={cn(
                                'shrink-0 min-w-[1.75rem] tabular-nums font-medium text-muted-foreground',
                                isRTL ? 'text-start' : 'text-end',
                              )}
                            >
                              {index + 1}.
                            </span>
                            <div
                              className={cn(
                                'flex min-w-0 flex-1 flex-wrap items-center gap-2',
                                isRTL && 'flex-row-reverse',
                              )}
                              aria-label={`${displayLabel}. ${statusLabel}`}
                            >
                              {visual === 'locked' ? (
                                <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                              ) : visual === 'done' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" aria-hidden />
                              ) : isNextUp ? (
                                <PlayCircle className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                              )}
                              {locked || assignmentUnavailable ? (
                                <span className="text-muted-foreground">{displayLabel}</span>
                              ) : (
                                <Link
                                  to={`/student/assignment/${step.assignment_id}`}
                                  state={{ returnClassroomSection: 'curriculum' }}
                                  className={cn(
                                    buttonVariants({ variant: 'link', size: 'default' }),
                                    'inline-flex h-auto min-h-0 max-w-full items-center gap-1 p-0 text-base',
                                  )}
                                >
                                  <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </Link>
                              )}
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
                      const nextIdx = firstIncompleteComputedIndex(computed, flowCtx);
                      return computed.map((c, idx) => {
                        const visual = computedStepVisualState(c, computed, idx, flowCtx);
                        const locked = visual === 'locked';
                        const isNextUp = nextIdx === idx && visual === 'available';
                        const statusLabel = t(`studentClassroom.activities.stepA11y.${visual}`);

                        if (c.kind === 'resource') {
                          const r = resourceMap[section.id]?.find((x) => x.id === c.activity_list_id);
                          const label = r?.title ?? t('studentClassroom.activities.activity');
                          return (
                            <li
                              key={`r-${c.activity_list_id}-${idx}`}
                              className="flex min-w-0 items-center gap-2 text-sm"
                            >
                              <span
                                className={cn(
                                  'shrink-0 min-w-[1.75rem] tabular-nums font-medium text-muted-foreground',
                                  isRTL ? 'text-start' : 'text-end',
                                )}
                              >
                                {idx + 1}.
                              </span>
                              <div
                                className={cn(
                                  'flex min-w-0 flex-1 flex-wrap items-center gap-2',
                                  isRTL && 'flex-row-reverse',
                                )}
                                aria-label={`${label}. ${statusLabel}`}
                              >
                                {visual === 'locked' ? (
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
                                ) : (
                                  <Link
                                    to={`/student/classroom/${classroomId}/activity/${c.activity_list_id}`}
                                    state={{ returnClassroomSection: 'curriculum' }}
                                    className="inline-flex max-w-full items-center gap-1 font-medium text-primary hover:underline"
                                  >
                                    <FileText className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{label}</span>
                                  </Link>
                                )}
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
                        return (
                          <li
                            key={`a-${c.assignment_id}-${idx}`}
                            className="flex min-w-0 items-center gap-2 text-sm"
                          >
                            <span
                              className={cn(
                                'shrink-0 min-w-[1.75rem] tabular-nums font-medium text-muted-foreground',
                                isRTL ? 'text-start' : 'text-end',
                              )}
                            >
                              {idx + 1}.
                            </span>
                            <div
                              className={cn(
                                'flex min-w-0 flex-1 flex-wrap items-center gap-2',
                                isRTL && 'flex-row-reverse',
                              )}
                              aria-label={`${displayLabel}. ${statusLabel}`}
                            >
                              {visual === 'locked' ? (
                                <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                              ) : visual === 'done' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" aria-hidden />
                              ) : isNextUp ? (
                                <PlayCircle className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                              )}
                              {locked || assignmentUnavailable ? (
                                <span className="text-muted-foreground">{displayLabel}</span>
                              ) : (
                                <Link
                                  to={`/student/assignment/${c.assignment_id}`}
                                  state={{ returnClassroomSection: 'curriculum' }}
                                  className={cn(
                                    buttonVariants({ variant: 'link', size: 'default' }),
                                    'inline-flex h-auto min-h-0 max-w-full items-center gap-1 p-0 text-base',
                                  )}
                                >
                                  <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </Link>
                              )}
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
