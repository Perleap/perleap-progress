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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GripVertical, Trash2, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { boundedPointerAutoScroll } from '@/lib/dndAutoScroll';
import { cn } from '@/lib/utils';
import {
  isActivityCenterResource,
  moduleFlowLocalStepsEqual,
  moduleFlowLocalStepsToFlowInput,
  resolveDisplayedModuleFlowBase,
  type ModuleFlowLocalStep,
} from '@/lib/moduleFlow';
import {
  useModuleFlowSteps,
  useReplaceModuleFlow,
  useDeleteAssignment,
  useDeleteResource,
} from '@/hooks/queries';
import type { SectionResource } from '@/types/syllabus';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';

type LocalStep = ModuleFlowLocalStep;

type AssignmentLite = {
  id: string;
  title: string;
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

/** Merge server-derived `merged` with optimistic `prev` without replacing a valid local order when multisets match. */
function computeHydratedSteps(prev: LocalStep[], merged: LocalStep[]): LocalStep[] {
  if (prev.length === 0) return merged;
  const prevKeys = new Set(prev.map(stepSortId));
  const additions = merged.filter((s) => !prevKeys.has(stepSortId(s)));
  if (additions.length > 0) return [...prev, ...additions];
  if (isSameStepMultiset(prev, merged)) return prev;
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
  /** When set, assignment rows show an edit control that opens the teacher assignment editor. */
  onEditAssignment?: (assignmentId: string) => void;
  /** When set, activity/resource rows show an edit control that opens the lesson/activity editor. */
  onEditResource?: (resourceId: string) => void;
}

/** Vertical spine + node per step; non-interactive so drag handles keep hit targets. */
function ModuleFlowTimelineRail({
  index,
  total,
}: {
  index: number;
  total: number;
}) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  return (
    <div
      className="pointer-events-none flex w-5 shrink-0 flex-col items-center self-stretch"
      aria-hidden
    >
      {!isFirst ? <div className="min-h-[8px] w-px flex-1 bg-border" /> : <div className="h-3 shrink-0" />}
      <div className="z-[1] h-2.5 w-2.5 shrink-0 rounded-full border-2 border-primary bg-card shadow-sm" />
      {!isLast ? <div className="min-h-[8px] w-px flex-1 bg-border" /> : <div className="h-3 shrink-0" />}
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
      onEditAssignment,
      onEditResource,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const { data: persisted = [], isLoading, isFetching } = useModuleFlowSteps(sectionId);
    const replaceMutation = useReplaceModuleFlow();
    const deleteAssignmentMutation = useDeleteAssignment();
    const deleteResourceMutation = useDeleteResource();
    const [createAssignmentOpen, setCreateAssignmentOpen] = useState(false);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);

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
      /** Editor uses base flow only (no appendMissing): student list elsewhere still uses `resolveDisplayedModuleFlow`. */
      const merged = resolveDisplayedModuleFlowBase(sectionId, resources, assignments, persistedForResolve);
      const prevSnap = localStepsRef.current;
      const next = computeHydratedSteps(prevSnap, merged);
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
        if (ok) setLocalSteps(next);
      },
      [persistFlow, resourceById, t],
    );

    useImperativeHandle(ref, () => ({ appendStep }), [appendStep]);

    const activeStep =
      activeDragId != null
        ? localSteps.find((s) => stepSortId(s) === activeDragId)
        : null;

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
                return (
                  <SortableFlowRow key={sid} id={sid}>
                    {({ dragAttributes, dragListeners }) => (
                      <div
                        className={cn(
                          'flex min-w-0 items-stretch gap-3',
                          isRTL && 'flex-row-reverse',
                        )}
                      >
                        <ModuleFlowTimelineRail index={index} total={localSteps.length} />
                        <div
                          className={cn(
                            'flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card p-3',
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
                                : t('classroomDetail.activitiesFlow.stepAssignment')}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {step.kind === 'assignment' && onEditAssignment ? (
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
                              onClick={() => void remove(index)}
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
            className="pointer-events-none mt-2 min-h-[3.5rem] w-full shrink-0 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/25"
          />
          <DragOverlay dropAnimation={null}>
            {activeStep ? (
              <div
                className={cn(
                  'flex min-w-0 items-stretch gap-3 shadow-xl will-change-transform [backface-visibility:hidden]',
                  isRTL && 'flex-row-reverse',
                )}
              >
                <ModuleFlowTimelineRail index={0} total={1} />
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
      </div>
    );
  },
);
