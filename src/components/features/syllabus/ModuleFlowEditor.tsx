import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DraggableAttributes,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link, useNavigate } from 'react-router-dom';
import { GripVertical, Trash2, Plus, Pencil, Eye, PlayCircle, Radio } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import type { ActivityLinkState } from '@/types/navigation';
import { toast } from 'sonner';
import { boundedPointerAutoScroll } from '@/lib/dndAutoScroll';
import { cn } from '@/lib/utils';
import {
  isActivityCenterResource,
  moduleFlowLocalStepsEqual,
  moduleFlowLocalStepsToFlowInput,
  resolveTeacherCurriculumModuleFlow,
  type ModuleFlowLocalStep,
} from '@/lib/moduleFlow';
import {
  useModuleFlowSteps,
  useReplaceModuleFlow,
  useDeleteAssignment,
  useDeleteResource,
} from '@/hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import { assignmentKeys } from '@/hooks/queries/useAssignmentQueries';
import type { SectionResource } from '@/types/syllabus';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { CreateLiveSessionDialog } from '@/components/features/liveSession/CreateLiveSessionDialog';
import { buildRoute } from '@/config/routes';

type LocalStep = ModuleFlowLocalStep;

type AssignmentLite = {
  id: string;
  title: string;
  type?: string | null;
  syllabus_section_id?: string | null;
  due_at?: string | null;
};

export type ModuleFlowEditorHandle = {
  appendStep: (kind: 'resource' | 'assignment', id: string) => Promise<void>;
};

function stepSortId(step: LocalStep): string {
  return step.kind === 'resource' ? `res:${step.resourceId}` : `asg:${step.assignmentId}`;
}

/** Same steps (resources + assignments) regardless of order — used to avoid clobbering a drag reorder with stale React Query data. */
function isSameStepMultiset(a: LocalStep[], b: LocalStep[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const s of a) {
    const k = stepSortId(s);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const s of b) {
    const k = stepSortId(s);
    const n = counts.get(k);
    if (n === undefined || n <= 0) return false;
    counts.set(k, n - 1);
  }
  return [...counts.values()].every((n) => n === 0);
}

/**
 * Merge server-derived `merged` with optimistic `prev`.
 * When the step multiset matches but order differs, prefer `merged` unless a flow replace is in flight
 * (keeps drag-and-drop optimistic order until persist completes).
 */
function computeHydratedSteps(
  prev: LocalStep[],
  merged: LocalStep[],
  replacePending: boolean,
): LocalStep[] {
  if (prev.length === 0) return merged;
  const prevKeys = new Set(prev.map(stepSortId));
  const additions = merged.filter((s) => !prevKeys.has(stepSortId(s)));
  if (additions.length > 0) return [...prev, ...additions];
  if (isSameStepMultiset(prev, merged)) {
    if (!replacePending && !moduleFlowLocalStepsEqual(prev, merged)) return merged;
    return prev;
  }
  return moduleFlowLocalStepsEqual(prev, merged) ? prev : merged;
}

interface ModuleFlowEditorProps {
  /** Shown on the left; + menu on the right. Sortable list is only below this row. */
  flowHeading: ReactNode;
  sectionId: string;
  classroomId: string;
  resources: SectionResource[];
  assignments: AssignmentLite[];
  isRTL: boolean;
  onRequestNewActivity?: () => void;
  /** Opens the assignment editor (e.g. wizard) to view the task. */
  onViewAssignment?: (assignmentId: string) => void;
  /** Opens the assignment editor for editing (e.g. wizard). */
  onEditAssignment?: (assignmentId: string) => void;
  /** When set, activity/resource rows show an edit control that opens the lesson/activity editor. */
  onEditResource?: (resourceId: string) => void;
}

/** Step index label in a circle; no connector lines (visual parity with student curriculum rail). */
function ModuleFlowTimelineRail({ stepNumber }: { stepNumber: number }) {
  return (
    <div
      className="pointer-events-none flex w-9 shrink-0 flex-col items-center justify-center self-center"
      aria-hidden
    >
      <div className="z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-card text-xs font-semibold tabular-nums text-foreground shadow-sm">
        {stepNumber}
      </div>
    </div>
  );
}

function SortableFlowRow({
  id,
  children,
}: {
  id: string;
  children: (args: {
    dragAttributes: DraggableAttributes;
    dragListeners: Record<string, unknown> | undefined;
  }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0 : undefined,
  };
  return (
    <li ref={setNodeRef} style={style} className={cn('list-none', isDragging && 'z-10')}>
      {children({ dragAttributes: attributes, dragListeners: listeners })}
    </li>
  );
}

export const ModuleFlowEditor = forwardRef<ModuleFlowEditorHandle, ModuleFlowEditorProps>(
  function ModuleFlowEditor(
    {
      flowHeading,
      sectionId,
      classroomId,
      resources,
      assignments,
      isRTL,
      onRequestNewActivity,
      onViewAssignment,
      onEditAssignment,
      onEditResource,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const activityLinkState: ActivityLinkState = {
      returnClassroomSection: 'outline',
    };

    const { data: persisted = [], isLoading, isFetching } = useModuleFlowSteps(sectionId);
    const replaceMutation = useReplaceModuleFlow();
    const deleteAssignmentMutation = useDeleteAssignment();
    const deleteResourceMutation = useDeleteResource();
    const [createAssignmentOpen, setCreateAssignmentOpen] = useState(false);
    const [createLiveSessionOpen, setCreateLiveSessionOpen] = useState(false);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const sectionAssignments = useMemo(
      () => assignments.filter((a) => a.syllabus_section_id === sectionId),
      [assignments, sectionId],
    );

    /** Stable ref — inline object would retrigger CreateAssignmentDialog effects every render. */
    const createAssignmentInitialData = useMemo(
      () => ({ syllabus_section_id: sectionId }),
      [sectionId],
    );
    const noopAssignmentSuccess = useCallback(() => {}, []);

    const [localSteps, setLocalSteps] = useState<LocalStep[]>([]);
    const localStepsRef = useRef(localSteps);
    localStepsRef.current = localSteps;

    const persistFlow = useCallback(
      async (nextSteps: LocalStep[]): Promise<boolean> => {
        try {
          await replaceMutation.mutateAsync({
            sectionId,
            classroomId,
            steps: moduleFlowLocalStepsToFlowInput(nextSteps),
          });
          return true;
        } catch {
          toast.error(t('classroomDetail.activitiesFlow.saveFailed'));
          return false;
        }
      },
      [classroomId, replaceMutation, sectionId, t],
    );

    useEffect(() => {
      const persistedForResolve = isLoading ? [] : persisted;
      /** Same orphan filtering as teacher Curriculum; no student `appendMissing*` merge. */
      const merged = resolveTeacherCurriculumModuleFlow(sectionId, resources, assignments, persistedForResolve);
      const prevSnap = localStepsRef.current;
      const next = computeHydratedSteps(prevSnap, merged, replaceMutation.isPending);
      const prevKeys = new Set(prevSnap.map(stepSortId));
      const additions = merged.filter((s) => !prevKeys.has(stepSortId(s)));

      setLocalSteps((p) => (moduleFlowLocalStepsEqual(p, next) ? p : next));

      /** Avoid re-persisting "additions" while server snapshot is stale (e.g. right after delete). */
      const blockAdditionsAutoPersist =
        replaceMutation.isPending ||
        (isFetching && prevSnap.length > 0 && additions.length > 0);

      if (!isLoading && !blockAdditionsAutoPersist) {
        if (additions.length > 0) {
          void persistFlow([...prevSnap, ...additions]);
        }
      }
    }, [
      persisted,
      isLoading,
      isFetching,
      sectionId,
      resources,
      assignments,
      sectionAssignments,
      persistFlow,
      replaceMutation.isPending,
    ]);

    const sortableIds = useMemo(() => localSteps.map(stepSortId), [localSteps]);

    const handleDragStart = (event: DragStartEvent) => {
      setActiveDragId(String(event.active.id));
    };

    const handleDragEnd = (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setLocalSteps((prev) => {
        const oldIndex = prev.findIndex((s) => stepSortId(s) === String(active.id));
        const newIndex = prev.findIndex((s) => stepSortId(s) === String(over.id));
        if (oldIndex < 0 || newIndex < 0) return prev;
        const next = arrayMove(prev, oldIndex, newIndex);
        void persistFlow(next);
        return next;
      });
    };

    const handleDragCancel = () => {
      setActiveDragId(null);
    };

    const remove = useCallback(
      async (index: number) => {
        const rows = localStepsRef.current;
        const removed = rows[index];
        if (!removed) return;
        const next = rows.filter((_, i) => i !== index);
        setLocalSteps(next);
        const ok = await persistFlow(next);
        if (ok && removed.kind === 'assignment') {
          try {
            await deleteAssignmentMutation.mutateAsync({
              assignmentId: removed.assignmentId,
              classroomId,
            });
          } catch {
            toast.error(t('classroomDetail.errors.deleting'));
          }
        }
        if (ok && removed.kind === 'resource') {
          try {
            const filePath =
              resources.find((r) => r.id === removed.resourceId)?.file_path ?? null;
            await deleteResourceMutation.mutateAsync({
              resourceId: removed.resourceId,
              filePath,
              sectionId,
              classroomId,
            });
          } catch {
            toast.error(t('classroomDetail.activities.deleteFailed'));
          }
        }
      },
      [
        classroomId,
        deleteAssignmentMutation,
        deleteResourceMutation,
        persistFlow,
        resources,
        sectionId,
        t,
      ],
    );

    const resourceById = useMemo(() => {
      const m: Record<string, SectionResource> = {};
      resources.forEach((r) => {
        m[r.id] = r;
      });
      return m;
    }, [resources]);

    const assignmentById = useMemo(() => {
      const m: Record<string, AssignmentLite> = {};
      sectionAssignments.forEach((a) => {
        m[a.id] = a;
      });
      return m;
    }, [sectionAssignments]);

    const pendingDeleteStep =
      deleteConfirmIndex != null ? localSteps[deleteConfirmIndex] : null;

    const deleteConfirmCopy = useMemo(() => {
      if (!pendingDeleteStep) return null;
      if (pendingDeleteStep.kind === 'resource') {
        const name =
          resourceById[pendingDeleteStep.resourceId]?.title ?? pendingDeleteStep.resourceId;
        return {
          title: t('classroomDetail.activities.deleteTitle'),
          description: t('classroomDetail.activities.deleteDescription', { name }),
          confirmLabel: t('classroomDetail.activities.deleteConfirm'),
        };
      }
      const assignment = assignmentById[pendingDeleteStep.assignmentId];
      const name = assignment?.title ?? pendingDeleteStep.assignmentId;
      if (assignment?.type === 'live_session') {
        return {
          title: t('classroomDetail.activitiesFlow.deleteLiveSessionTitle'),
          description: t('classroomDetail.activitiesFlow.deleteLiveSessionDescription', { name }),
          confirmLabel: t('common.delete'),
        };
      }
      return {
        title: t('classroomDetail.activitiesFlow.deleteAssignmentTitle'),
        description: t('classroomDetail.activitiesFlow.deleteAssignmentDescription', { name }),
        confirmLabel: t('common.delete'),
      };
    }, [pendingDeleteStep, resourceById, assignmentById, t]);

    const deletePending =
      replaceMutation.isPending ||
      deleteAssignmentMutation.isPending ||
      deleteResourceMutation.isPending;

    const handleConfirmDelete = useCallback(() => {
      if (deleteConfirmIndex === null) return;
      const index = deleteConfirmIndex;
      setDeleteConfirmIndex(null);
      void remove(index);
    }, [deleteConfirmIndex, remove]);

    const appendStep = useCallback(
      async (kind: 'resource' | 'assignment', id: string) => {
        const prev = localStepsRef.current;
        if (kind === 'resource') {
          if (prev.some((s) => s.kind === 'resource' && s.resourceId === id)) return;
          const r = resourceById[id];
          if (r && !isActivityCenterResource(r)) {
            toast.error(t('classroomDetail.activitiesFlow.saveFailed'));
            return;
          }
        } else if (prev.some((s) => s.kind === 'assignment' && s.assignmentId === id)) {
          return;
        }
        const next: LocalStep[] = [
          ...prev,
          kind === 'resource' ? { kind: 'resource', resourceId: id } : { kind: 'assignment', assignmentId: id },
        ];
        const ok = await persistFlow(next);
        if (ok) {
          setLocalSteps(next);
          void queryClient.invalidateQueries({
            queryKey: assignmentKeys.classroomAssignmentLists(classroomId),
            exact: false,
          });
        }
      },
      [persistFlow, resourceById, t, queryClient, classroomId],
    );

    useImperativeHandle(ref, () => ({ appendStep }), [appendStep]);

    const activeStep =
      activeDragId != null
        ? localSteps.find((s) => stepSortId(s) === activeDragId)
        : null;
    const activeDragIndex =
      activeDragId != null ? localSteps.findIndex((s) => stepSortId(s) === activeDragId) : -1;

    return (
      <div className="space-y-3">
        <div
          className={cn(
            'flex items-start gap-3 justify-between',
            isRTL && 'flex-row-reverse',
          )}
        >
          <div
            className={cn(
              'min-w-0 flex-1 space-y-1',
              isRTL ? 'text-right' : 'text-left',
            )}
          >
            <div className="text-sm font-semibold text-foreground">{flowHeading}</div>
            <p className="text-sm text-muted-foreground">{t('classroomDetail.activitiesFlow.hint')}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 self-start rounded-lg mt-0.5"
                aria-label={t('classroomDetail.activitiesFlow.addNewStep')}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  setCreateAssignmentOpen(true);
                }}
              >
                {t('classroomDetail.activitiesFlow.createAssignment')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  onRequestNewActivity?.();
                }}
                disabled={!onRequestNewActivity}
              >
                {t('classroomDetail.activitiesFlow.createActivity')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  setCreateLiveSessionOpen(true);
                }}
              >
                {t('classroomDetail.activitiesFlow.createLiveSession')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          autoScroll={boundedPointerAutoScroll}
          modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <ul className="min-w-0 space-y-2 [contain:layout]">
              {localSteps.map((step, index) => {
                const sid = stepSortId(step);
                const isLiveSession =
                  step.kind === 'assignment' &&
                  assignmentById[step.assignmentId]?.type === 'live_session';
                return (
                  <SortableFlowRow key={sid} id={sid}>
                    {({ dragAttributes, dragListeners }) => (
                      <div
                        className={cn(
                          'flex min-w-0 items-center gap-3',
                          isRTL && 'flex-row-reverse',
                        )}
                      >
                        <ModuleFlowTimelineRail stepNumber={index + 1} />
                        <div
                          className={cn(
                            'flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-card p-3',
                            isRTL && 'flex-row-reverse',
                            activeDragId === sid && 'ring-2 ring-primary/25 shadow-md',
                          )}
                        >
                          <button
                            type="button"
                            className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 rounded-md shrink-0"
                            aria-label={t('classroomDetail.activitiesFlow.dragReorder')}
                            {...dragListeners}
                            {...dragAttributes}
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <div className="min-w-0 flex-1">
                            {step.kind === 'resource' ? (
                              <span className="text-sm font-medium truncate">
                                {resourceById[step.resourceId]?.title ?? step.resourceId}
                              </span>
                            ) : (
                              <span className="text-sm font-medium truncate">
                                {assignmentById[step.assignmentId]?.title ?? step.assignmentId}
                              </span>
                            )}
                            <span className="block text-xs text-muted-foreground">
                              {step.kind === 'resource'
                                ? t('classroomDetail.activitiesFlow.stepResource')
                                : isLiveSession
                                  ? t('classroomDetail.activitiesFlow.stepLiveSession')
                                  : t('classroomDetail.activitiesFlow.stepAssignment')}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {step.kind === 'resource' ? (
                              <>
                                <Link
                                  to={`/teacher/classroom/${classroomId}/activity/${step.resourceId}`}
                                  state={activityLinkState}
                                  className={cn(
                                    buttonVariants({ variant: 'ghost', size: 'icon' }),
                                    'h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground',
                                  )}
                                  aria-label={t('classroomDetail.activitiesFlow.viewActivity')}
                                >
                                  <Eye className="h-4 w-4" />
                                </Link>
                                <Link
                                  to={`/teacher/classroom/${classroomId}/try/activity/${step.resourceId}`}
                                  state={activityLinkState}
                                  className={cn(
                                    buttonVariants({ variant: 'ghost', size: 'icon' }),
                                    'h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground',
                                  )}
                                  aria-label={t('classroomDetail.activitiesFlow.tryActivity')}
                                >
                                  <PlayCircle className="h-4 w-4" />
                                </Link>
                              </>
                            ) : isLiveSession ? (
                              <Link
                                to={`/teacher/classroom/${classroomId}/live-session/${step.assignmentId}`}
                                className={cn(
                                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                                  'h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground',
                                )}
                                aria-label={t('liveSession.open')}
                              >
                                <Radio className="h-4 w-4" />
                              </Link>
                            ) : onViewAssignment ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                                aria-label={t('classroomDetail.activitiesFlow.viewAssignment')}
                                onClick={() => onViewAssignment(step.assignmentId)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {step.kind === 'assignment' && !isLiveSession ? (
                              <Link
                                to={`/teacher/classroom/${classroomId}/try/assignment/${step.assignmentId}`}
                                className={cn(
                                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                                  'h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground',
                                )}
                                aria-label={t('classroomDetail.activitiesFlow.tryAssignment')}
                              >
                                <PlayCircle className="h-4 w-4" />
                              </Link>
                            ) : null}
                            {step.kind === 'assignment' && !isLiveSession && onEditAssignment ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                                aria-label={t('classroomDetail.activitiesFlow.editStep')}
                                onClick={() => onEditAssignment(step.assignmentId)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {step.kind === 'resource' && onEditResource ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                                aria-label={t('classroomDetail.activitiesFlow.editStep')}
                                onClick={() => onEditResource(step.resourceId)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-destructive"
                              aria-label={t('common.delete')}
                              onClick={() => setDeleteConfirmIndex(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </SortableFlowRow>
                );
              })}
            </ul>
          </SortableContext>
          <div
            aria-hidden
            className="pointer-events-none mt-2 min-h-[3.5rem] w-full shrink-0"
          />
          <DragOverlay dropAnimation={null}>
            {activeStep ? (
              <div
                className={cn(
                  'flex min-w-0 items-center gap-3 shadow-xl will-change-transform [backface-visibility:hidden]',
                  isRTL && 'flex-row-reverse',
                )}
              >
                <ModuleFlowTimelineRail
                  stepNumber={activeDragIndex >= 0 ? activeDragIndex + 1 : 1}
                />
                <div
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card p-3',
                    isRTL && 'flex-row-reverse',
                  )}
                >
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    {activeStep.kind === 'resource' ? (
                      <span className="text-sm font-medium truncate">
                        {resourceById[activeStep.resourceId]?.title ?? activeStep.resourceId}
                      </span>
                    ) : (
                      <span className="text-sm font-medium truncate">
                        {assignmentById[activeStep.assignmentId]?.title ?? activeStep.assignmentId}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {localSteps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('classroomDetail.activitiesFlow.empty')}</p>
        ) : null}

        <CreateAssignmentDialog
          open={createAssignmentOpen}
          onOpenChange={setCreateAssignmentOpen}
          classroomId={classroomId}
          lockSyllabusSection
          initialData={createAssignmentInitialData}
          onSuccess={noopAssignmentSuccess}
          onCreatedAssignment={(assignmentId) => {
            void appendStep('assignment', assignmentId);
            setCreateAssignmentOpen(false);
          }}
        />

        <CreateLiveSessionDialog
          open={createLiveSessionOpen}
          onOpenChange={setCreateLiveSessionOpen}
          classroomId={classroomId}
          syllabusSectionId={sectionId}
          onAssignmentCreated={(assignmentId) => {
            void appendStep('assignment', assignmentId);
          }}
          onCreated={(assignmentId) => {
            setCreateLiveSessionOpen(false);
            navigate(buildRoute.teacherLiveSession(classroomId, assignmentId));
          }}
        />

        <AlertDialog
          open={deleteConfirmIndex !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirmIndex(null);
          }}
        >
          <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'} className="rounded-xl">
            <AlertDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
              <AlertDialogTitle>{deleteConfirmCopy?.title}</AlertDialogTitle>
              <AlertDialogDescription>{deleteConfirmCopy?.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className={isRTL ? 'flex-row-reverse sm:space-x-reverse' : ''}>
              <AlertDialogCancel disabled={deletePending} className="mt-0">
                {t('common.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deletePending}
                onClick={handleConfirmDelete}
              >
                {deleteConfirmCopy?.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  },
);
