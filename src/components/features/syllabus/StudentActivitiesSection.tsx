import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Loader2, Lock, CheckCircle2, Circle, ClipboardList, FileText, PlayCircle, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useSyllabus,
  useClassroomAssignments,
  useStudentProgress,
} from '@/hooks/queries';
import {
  useModuleFlowStepsBulk,
  useStudentModuleFlowProgressMap,
} from '@/hooks/queries/useModuleFlowQueries';
import { hasCompletedAssignmentSubmission } from '@/services/moduleFlowService';
import { isSectionUnlocked } from '@/lib/sectionUnlock';
import {
  computeDefaultModuleFlow,
  getOrderedActivityCenterFlowSteps,
} from '@/lib/moduleFlow';
import {
  type StudentFlowProgressContext,
  persistedStepVisualState,
  computedStepVisualState,
  firstIncompletePersistedIndex,
  firstIncompleteComputedIndex,
} from '@/lib/moduleFlowStudent';
import { cn } from '@/lib/utils';
import type { ReleaseMode, StudentProgressStatus } from '@/types/syllabus';

interface StudentActivitiesSectionProps {
  classroomId: string;
  isRTL: boolean;
}

export function StudentActivitiesSection({ classroomId, isRTL }: StudentActivitiesSectionProps) {
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

  const allStepIds = useMemo(() => {
    const ids: string[] = [];
    sectionIds.forEach((sid) => {
      const persisted = flowBulk[sid] ?? [];
      const sectionResources = resourceMap[sid] ?? [];
      getOrderedActivityCenterFlowSteps(persisted, sectionResources).forEach((s) => ids.push(s.id));
    });
    return ids;
  }, [flowBulk, sectionIds, resourceMap]);

  const { data: progressByStep = {} } = useStudentModuleFlowProgressMap(user?.id, allStepIds);

  const assignmentIdsInFlow = useMemo(() => {
    const set = new Set<string>();
    const assignRows = assignments as { id: string; syllabus_section_id?: string | null; due_at?: string | null }[];
    sectionIds.forEach((sid) => {
      const persisted = flowBulk[sid] ?? [];
      const sectionResources = resourceMap[sid] ?? [];
      getOrderedActivityCenterFlowSteps(persisted, sectionResources).forEach((step) => {
        if (step.step_kind === 'assignment' && step.assignment_id) set.add(step.assignment_id);
      });
      computeDefaultModuleFlow(sid, sectionResources, assignRows).forEach((c) => {
        if (c.kind === 'assignment') set.add(c.assignment_id);
      });
    });
    return [...set];
  }, [flowBulk, sectionIds, resourceMap, assignments]);

  const assignmentDoneQueries = useQueries({
    queries: assignmentIdsInFlow.map((aid) => ({
      queryKey: ['assignment-flow-complete', aid, user?.id],
      queryFn: async () => {
        const { completed, error } = await hasCompletedAssignmentSubmission(aid, user!.id);
        if (error) throw error;
        return { aid, completed };
      },
      enabled: !!user?.id && !!aid,
    })),
  });

  const assignmentDoneMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    assignmentDoneQueries.forEach((q, i) => {
      const aid = assignmentIdsInFlow[i];
      if (aid && q.data) m[aid] = q.data.completed;
    });
    return m;
  }, [assignmentDoneQueries, assignmentIdsInFlow]);

  const flowCtx: StudentFlowProgressContext = useMemo(
    () => ({ progressByStep, assignmentDoneMap }),
    [progressByStep, assignmentDoneMap],
  );

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

      {sections.map((section) => {
        const unlocked = isSectionUnlocked(section, sections, releaseMode, studentProgressMap);
        const persisted = flowBulk[section.id] ?? [];
        const sectionResources = resourceMap[section.id] ?? [];
        const orderedPersisted = getOrderedActivityCenterFlowSteps(persisted, sectionResources);
        const computed = computeDefaultModuleFlow(
          section.id,
          sectionResources,
          assignments as { id: string; syllabus_section_id?: string | null; due_at?: string | null }[],
        );

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
            className="rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
          >
            <div
              className={cn(
                'flex min-w-0 items-start gap-2 border-b border-transparent px-3 py-3 sm:px-4',
                open && 'border-border/60',
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
            </div>

            <CollapsibleContent>
              <div className="space-y-2 px-3 pb-4 pt-1 sm:px-4">
              {!unlocked ? (
                <p className="text-sm text-muted-foreground">{t('studentClassroom.activities.unlockHint')}</p>
              ) : usePersisted && steps ? (
                <ol className="space-y-2 list-decimal list-inside">
                  {(() => {
                    const nextIdx = firstIncompletePersistedIndex(steps, flowCtx);
                    return steps.map((step, index) => {
                      const visual = persistedStepVisualState(step, steps, index, flowCtx);
                      const locked = visual === 'locked';
                      const isNextUp = nextIdx === index && visual === 'available';
                      const statusLabel = t(`studentClassroom.activities.stepA11y.${visual}`);

                      if (step.step_kind === 'resource' && step.section_resource_id) {
                        const label =
                          resourceMap[section.id]?.find((r) => r.id === step.section_resource_id)?.title ??
                          t('studentClassroom.activities.activity');
                        return (
                          <li key={step.id} className="text-sm">
                            <div
                              className={cn('inline-flex flex-wrap items-center gap-2', isRTL && 'flex-row-reverse')}
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
                                  to={`/student/classroom/${classroomId}/activity/${step.section_resource_id}`}
                                  state={{ returnClassroomSection: 'curriculum' }}
                                  className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  {label}
                                </Link>
                              )}
                            </div>
                          </li>
                        );
                      }

                      if (step.step_kind === 'assignment' && step.assignment_id) {
                        const a = (assignments as { id: string; title: string }[]).find((x) => x.id === step.assignment_id);
                        const label = a?.title ?? t('studentClassroom.activities.assignment');
                        return (
                          <li key={step.id} className="text-sm">
                            <div
                              className={cn('inline-flex flex-wrap items-center gap-2', isRTL && 'flex-row-reverse')}
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
                                  to={`/student/assignment/${step.assignment_id}`}
                                  className={cn(
                                    buttonVariants({ variant: 'link', size: 'default' }),
                                    'h-auto p-0 text-base inline-flex items-center gap-1',
                                  )}
                                >
                                  <ClipboardList className="h-3.5 w-3.5" />
                                  {label}
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
                  <ol className="space-y-2 list-decimal list-inside">
                    {(() => {
                      const nextIdx = firstIncompleteComputedIndex(computed, flowCtx);
                      return computed.map((c, idx) => {
                        const visual = computedStepVisualState(c, computed, idx, flowCtx);
                        const locked = visual === 'locked';
                        const isNextUp = nextIdx === idx && visual === 'available';
                        const statusLabel = t(`studentClassroom.activities.stepA11y.${visual}`);

                        if (c.kind === 'resource') {
                          const r = resourceMap[section.id]?.find((x) => x.id === c.section_resource_id);
                          const label = r?.title ?? t('studentClassroom.activities.activity');
                          return (
                            <li key={`r-${c.section_resource_id}-${idx}`} className="text-sm">
                              <div
                                className={cn('inline-flex flex-wrap items-center gap-2', isRTL && 'flex-row-reverse')}
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
                                    to={`/student/classroom/${classroomId}/activity/${c.section_resource_id}`}
                                    state={{ returnClassroomSection: 'curriculum' }}
                                    className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                    {label}
                                  </Link>
                                )}
                              </div>
                            </li>
                          );
                        }
                        const a = (assignments as { id: string; title: string }[]).find((x) => x.id === c.assignment_id);
                        const label = a?.title ?? t('studentClassroom.activities.assignment');
                        return (
                          <li key={`a-${c.assignment_id}-${idx}`} className="text-sm">
                            <div
                              className={cn('inline-flex flex-wrap items-center gap-2', isRTL && 'flex-row-reverse')}
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
                                  to={`/student/assignment/${c.assignment_id}`}
                                  className={cn(
                                    buttonVariants({ variant: 'link', size: 'default' }),
                                    'h-auto p-0 text-base inline-flex items-center gap-1',
                                  )}
                                >
                                  <ClipboardList className="h-3.5 w-3.5" />
                                  {label}
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
          </Collapsible>
        );
      })}
    </div>
  );
}
