import {
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  Link as LinkIcon,
  Lock,
  Play,
  Plus,
} from 'lucide-react';
import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type {
  ReleaseMode,
  SectionResource,
  StudentProgressStatus,
  SyllabusSection,
  SyllabusStructureType,
} from '@/types/syllabus';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/useAuth';
import {
  useClassroomAssignments,
  useModuleFlowStepsBulk,
  useStudentCurriculumFlowContext,
  useSyllabus,
} from '@/hooks/queries';
import { isSectionActivityFlowFullyComplete } from '@/lib/moduleFlowStudent';
import { isSectionUnlocked, sectionsInCourseOrder } from '@/lib/sectionUnlock';
import { cn } from '@/lib/utils';

export interface ModuleSyllabusAccordionProps {
  sections: SyllabusSection[];
  sectionResources?: Record<string, SectionResource[]>;
  linkedAssignmentsMap?: Record<
    string,
    Array<{ id: string; title: string; type: string; due_at: string | null; status?: string }>
  >;
  classroomId: string;
  structureType?: SyllabusStructureType;
  releaseMode?: ReleaseMode;
  mode: 'teacher' | 'student';
  isRTL?: boolean;
  studentProgressMap?: Record<string, StudentProgressStatus>;
  /** When false, hides the Course Syllabus title + course summary (expand/collapse still shown). */
  showCourseHeader?: boolean;
  /** Student: open full module view */
  onOpenModule?: (sectionId: string) => void;
  /** Teacher: create assignment for this module */
  onCreateAssignment?: (sectionId: string) => void;
  /** Teacher: jump to section editor / add resources */
  onAddActivity?: (sectionId: string) => void;
  /** Teacher: open assignment editor (e.g. parent holds EditAssignmentDialog) */
  onTeacherAssignmentClick?: (assignmentId: string) => void;
}

function resourceIcon(type: SectionResource['resource_type']) {
  switch (type) {
    case 'video':
      return Play;
    case 'link':
      return LinkIcon;
    case 'text':
      return FileText;
    default:
      return FileText;
  }
}

/** Sum minutes from resources; returns null if total is 0. */
function formatModuleDuration(resources: SectionResource[]): string | null {
  const mins = resources.reduce((acc, r) => acc + (r.estimated_duration_minutes ?? 0), 0);
  return formatTotalMinutes(mins);
}

function formatTotalMinutes(mins: number): string | null {
  if (mins <= 0) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const ModuleSyllabusAccordion = ({
  sections,
  sectionResources = {},
  linkedAssignmentsMap = {},
  classroomId,
  releaseMode = 'all_at_once',
  mode,
  isRTL,
  studentProgressMap = {},
  showCourseHeader = true,
  onOpenModule,
  onCreateAssignment,
  onAddActivity,
  onTeacherAssignmentClick,
}: ModuleSyllabusAccordionProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [openValues, setOpenValues] = useState<string[]>([]);

  /** Student: read section_resources + sections from the syllabus query so lists stay in sync after teacher edits (parent props can lag one render). */
  const { data: syllabusLive } = useSyllabus(mode === 'student' ? classroomId : undefined);
  const sectionResourcesEffective = useMemo(
    () =>
      mode === 'student'
        ? (syllabusLive?.section_resources as Record<string, SectionResource[]> | undefined) ??
          sectionResources
        : sectionResources,
    [mode, syllabusLive?.section_resources, sectionResources]
  );
  const sectionsEffective = useMemo(
    () =>
      mode === 'student' && syllabusLive?.sections?.length ? syllabusLive.sections : sections,
    [mode, syllabusLive?.sections, sections]
  );

  const ordered = useMemo(() => sectionsInCourseOrder(sectionsEffective), [sectionsEffective]);

  /** Same `release_mode` as `sectionsEffective` (avoids parent prop lag vs `useSyllabus` in this component). */
  const releaseModeEffective: ReleaseMode = useMemo(() => {
    if (mode === 'student' && syllabusLive?.release_mode) {
      return syllabusLive.release_mode as ReleaseMode;
    }
    return releaseMode ?? 'all_at_once';
  }, [mode, syllabusLive?.release_mode, releaseMode]);

  const allIds = useMemo(() => ordered.map((s) => s.id), [ordered]);

  const { data: flowBulk = {} } = useModuleFlowStepsBulk(
    mode === 'student' ? allIds : []
  );

  const { data: classroomAssignments = [] } = useClassroomAssignments(
    mode === 'student' ? classroomId : undefined
  );

  const assignmentRows = useMemo(() => {
    if (mode !== 'student') {
      return [] as { id: string; syllabus_section_id?: string | null; due_at?: string | null }[];
    }
    return (
      classroomAssignments as {
        id: string;
        syllabus_section_id?: string | null;
        due_at?: string | null;
      }[]
    ).map((a) => ({
      id: a.id,
      syllabus_section_id: a.syllabus_section_id,
      due_at: a.due_at ?? null,
    }));
  }, [mode, classroomAssignments]);

  const { flowCtx } = useStudentCurriculumFlowContext({
    userId: user?.id,
    sectionIds: allIds,
    flowBulk,
    resourceMap: sectionResourcesEffective,
    assignments: assignmentRows,
    enabled: mode === 'student' && allIds.length > 0,
  });

  const expandAll = useCallback(() => setOpenValues([...allIds]), [allIds]);
  const collapseAll = useCallback(() => setOpenValues([]), []);

  const allExpanded =
    allIds.length > 0 &&
    openValues.length === allIds.length &&
    allIds.every((id) => openValues.includes(id));

  const toggleExpandAll = useCallback(() => {
    if (allExpanded) collapseAll();
    else expandAll();
  }, [allExpanded, collapseAll, expandAll]);

  const courseRollup = useMemo(() => {
    if (mode === 'student') {
      return {
        modules: ordered.length,
        lessons: 0,
        durationFormatted: null as string | null,
      };
    }
    let lessonCount = 0;
    let totalMins = 0;
    ordered.forEach((s) => {
      const rawRes = sectionResourcesEffective[s.id] || [];
      const activities = rawRes.filter(
        (r) => mode === 'teacher' || (r.status ?? 'published') === 'published'
      );
      const assigns = (linkedAssignmentsMap[s.id] || []).filter(
        (a) => mode === 'teacher' || (a as { status?: string }).status !== 'draft'
      );
      lessonCount += activities.length + assigns.length;
      totalMins += activities.reduce((acc, r) => acc + (r.estimated_duration_minutes ?? 0), 0);
    });
    return {
      modules: ordered.length,
      lessons: lessonCount,
      durationFormatted: formatTotalMinutes(totalMins),
    };
  }, [mode, ordered, sectionResourcesEffective, linkedAssignmentsMap]);

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div
        className={cn(
          'flex flex-col gap-3 sm:flex-row sm:items-start',
          showCourseHeader ? 'sm:justify-between' : 'sm:justify-end',
          isRTL && 'sm:flex-row-reverse'
        )}
      >
        {showCourseHeader ? (
          <div className={cn('space-y-1 min-w-0 flex-1', isRTL && 'text-right')}>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              {t('syllabus.moduleAccordion.courseCurriculumTitle', 'Course Outline')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === 'student'
                ? t('syllabus.moduleAccordion.courseOutlineModuleCount', {
                    count: courseRollup.modules,
                    defaultValue: '{{count}} modules',
                  })
                : courseRollup.durationFormatted
                  ? t('syllabus.moduleAccordion.courseCurriculumSummaryWithDuration', {
                      modules: courseRollup.modules,
                      lessons: courseRollup.lessons,
                      duration: courseRollup.durationFormatted,
                      defaultValue: '{{modules}} modules • {{lessons}} lessons • {{duration}} total',
                    })
                  : t('syllabus.moduleAccordion.courseCurriculumSummaryNoDuration', {
                      modules: courseRollup.modules,
                      lessons: courseRollup.lessons,
                      defaultValue: '{{modules}} modules • {{lessons}} lessons',
                    })}
            </p>
          </div>
        ) : null}
        {mode === 'teacher' && allIds.length > 0 ? (
          <div className={cn('flex shrink-0 sm:pt-1', isRTL && 'flex-row-reverse')}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-primary"
              onClick={toggleExpandAll}
            >
              {allExpanded
                ? t('syllabus.moduleAccordion.collapseAll', 'Collapse all')
                : t('syllabus.moduleAccordion.expandAll', 'Expand all')}
            </Button>
          </div>
        ) : null}
      </div>

      {mode === 'student' ? (
        <>
          <p className={cn('text-sm text-muted-foreground mb-1', isRTL ? 'text-right' : 'text-left')}>
            {t(
              'syllabus.moduleAccordion.studentOutlineOpenModuleHint',
              'Select a module to open its study page. Activities and assignments are on that page.'
            )}
          </p>
          <div className="flex w-full flex-col gap-3">
            {ordered.map((section, flowStepIndex) => {
              const unlocked = isSectionUnlocked(
                section,
                ordered,
                releaseModeEffective,
                studentProgressMap,
              );
              const progressState = studentProgressMap[section.id];
              const flowComplete = isSectionActivityFlowFullyComplete(
                section.id,
                flowBulk[section.id] ?? [],
                sectionResourcesEffective[section.id] ?? [],
                assignmentRows,
                flowCtx,
              );
              const showFlowCheck = unlocked && flowComplete;
              const isLastFlowStep = flowStepIndex >= ordered.length - 1;
              return (
                <div
                  key={section.id}
                  className="overflow-hidden rounded-xl border border-border bg-card not-last:border-b-0"
                >
                  <div className={cn('flex min-w-0', isRTL ? 'flex-row-reverse' : 'flex-row')}>
                    <div
                      className="flex w-11 shrink-0 flex-col items-center border-border/50 border-e px-1 pt-3 pb-1"
                      aria-hidden
                    >
                      <div
                        className={cn(
                          'relative z-[1] flex h-8 w-8 items-center justify-center rounded-full border-2 bg-card text-xs font-semibold tabular-nums text-foreground',
                          showFlowCheck &&
                            'border-muted-foreground/40 bg-muted/50 text-muted-foreground',
                          (progressState === 'in_progress' || progressState === 'reviewed') &&
                            !showFlowCheck &&
                            unlocked &&
                            'border-primary ring-2 ring-primary/25 ring-offset-2 ring-offset-card',
                          !unlocked && 'opacity-60',
                        )}
                      >
                        {showFlowCheck ? (
                          <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
                        ) : (
                          flowStepIndex + 1
                        )}
                      </div>
                      {!isLastFlowStep ? (
                        <div className="mt-1 min-h-3 w-px shrink-0 grow basis-0 bg-border" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col">
                      <button
                        type="button"
                        disabled={!unlocked}
                        className={cn(
                          'flex min-h-[3.25rem] w-full min-w-0 items-center justify-between gap-3 px-3 py-3 text-start text-sm transition-colors',
                          'hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset',
                          !unlocked && 'cursor-not-allowed opacity-80',
                          unlocked && 'cursor-pointer',
                        )}
                        onClick={() => unlocked && onOpenModule?.(section.id)}
                        aria-label={t(
                          'syllabus.moduleAccordion.openModulePage',
                          'Open module: {{title}}',
                          { title: section.title },
                        )}
                      >
                        <div className={cn('flex min-w-0 flex-1 items-center gap-2')}>
                          {!unlocked && (
                            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          )}
                          <span className="font-semibold text-foreground truncate text-base">
                            {section.title}
                          </span>
                        </div>
                        <ChevronRight
                          className={cn(
                            'size-4 shrink-0 text-muted-foreground',
                            isRTL && 'rotate-180',
                          )}
                          aria-hidden
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
      <Accordion
        multiple
        value={openValues}
        onValueChange={(v) => setOpenValues(v as string[])}
        className="flex w-full flex-col gap-3"
      >
        {ordered.map((section) => {
          const rawRes = sectionResourcesEffective[section.id] || [];
          const activities = rawRes.filter((r) => (r.status ?? 'published') === 'published');
          const assigns = (linkedAssignmentsMap[section.id] || []).filter(
            (a) => (a as { status?: string }).status !== 'draft',
          );
          const unlocked =
            mode === 'teacher' ||
            isSectionUnlocked(section, ordered, releaseMode, studentProgressMap);

          const moduleDuration = formatModuleDuration(activities);
          const lessonCount = activities.length + assigns.length;
          const moduleRowMeta = moduleDuration
            ? t('syllabus.moduleAccordion.moduleRowMetaWithDuration', {
                count: lessonCount,
                duration: moduleDuration,
                defaultValue: '{{count}} activities • {{duration}}',
              })
            : t('syllabus.moduleAccordion.moduleRowMetaCountOnly', {
                count: lessonCount,
                defaultValue: '{{count}} activities',
              });

          return (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="overflow-hidden rounded-xl border border-border bg-card not-last:border-b-0"
            >
              <AccordionTrigger
                className={cn(
                  'px-4 py-3.5 hover:no-underline bg-card data-[state=open]:bg-muted/20 items-center',
                  !unlocked && 'opacity-70',
                )}
                disabled={!unlocked}
              >
                <div className="flex flex-1 min-w-0 items-center justify-between gap-3 pe-2">
                  <span className="font-semibold text-foreground truncate text-start text-base">
                    {section.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {moduleRowMeta}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="border-t border-border/60 bg-background px-0 pb-0 pt-0">
                <div className="space-y-0">
                  {section.description ? (
                    <p
                      className={cn(
                        'px-4 pt-3 pb-2 text-xs text-muted-foreground leading-relaxed',
                        isRTL && 'text-right',
                      )}
                    >
                      {section.description}
                    </p>
                  ) : null}

                  {activities.length === 0 && assigns.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">
                      {t(
                        'syllabus.moduleAccordion.emptyModule',
                        'No lessons in this module yet.',
                      )}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/80">
                      {activities.map((r) => {
                        const Icon = resourceIcon(r.resource_type);
                        const rowClass = cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors',
                          isRTL && 'flex-row-reverse text-right',
                        );
                        return (
                          <li key={r.id}>
                            <Link
                              to={`/teacher/classroom/${classroomId}/activity/${r.id}`}
                              state={{ returnClassroomSection: 'outline' }}
                              className={rowClass}
                            >
                              <Icon
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1 truncate font-normal">{r.title}</span>
                            </Link>
                          </li>
                        );
                      })}
                      {assigns.map((a) => {
                        const isQuiz = a.type === 'test';
                        const rowClass = cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/40 transition-colors',
                          isRTL && 'flex-row-reverse text-right',
                        );
                        return (
                          <li key={a.id}>
                            <button
                              type="button"
                              className={cn(rowClass, 'text-start text-foreground')}
                              onClick={() => onTeacherAssignmentClick?.(a.id)}
                            >
                              <ClipboardList
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                              <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
                                <span className="truncate font-normal">{a.title}</span>
                                {isQuiz ? (
                                  <span className="shrink-0 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    {t(
                                      'syllabus.moduleAccordion.assignmentQuizLabel',
                                      'Quiz',
                                    )}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div
                    className={cn(
                      'flex flex-wrap gap-2 border-t border-border/60 px-4 py-3',
                      isRTL && 'flex-row-reverse',
                    )}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg gap-1.5"
                      onClick={() => onAddActivity?.(section.id)}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      {t('syllabus.moduleAccordion.addActivity', 'Add activity')}
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="rounded-lg gap-1.5"
                      onClick={() => onCreateAssignment?.(section.id)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t('syllabus.moduleAccordion.createAssignment', 'Create assignment')}
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      )}
    </div>
  );
};
