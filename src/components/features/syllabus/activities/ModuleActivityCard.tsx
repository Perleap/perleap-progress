import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { ModuleFlowLocalStep } from '@/lib/moduleFlow';
import type { SectionResource } from '@/types/syllabus';
import { cn } from '@/lib/utils';
import { ModuleFlowStepListItem } from './ModuleFlowStepListItem';

type AssignmentLite = {
  id: string;
  title: string;
  status: 'draft' | 'published';
  due_at: string | null;
  type?: string;
};

export interface ModuleActivityCardProps {
  classroomId: string;
  section: { id: string; title: string };
  flowSteps: ModuleFlowLocalStep[];
  activityResources: SectionResource[];
  assignmentById: Record<string, AssignmentLite>;
  resourceById: Record<string, SectionResource>;
  isRTL: boolean;
  onOpenFlowSheet: () => void;
  onAddActivity: () => void;
  onCreateAssignmentForModule: () => void;
  onEditResource: (resourceId: string) => void;
  onEditAssignment?: (assignmentId: string) => void;
  onDeleteAssignment?: (assignmentId: string) => void;
  /** When set, collapsible state is controlled by the parent (expand/collapse all). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ModuleActivityCard({
  classroomId,
  section,
  flowSteps,
  activityResources,
  assignmentById,
  resourceById,
  isRTL,
  onOpenFlowSheet,
  onAddActivity,
  onCreateAssignmentForModule,
  onEditResource,
  onEditAssignment,
  onDeleteAssignment,
  open: openProp,
  onOpenChange,
}: ModuleActivityCardProps) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const handleOpenChange = (next: boolean) => {
    if (isControlled) {
      onOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  };

  const flowResourceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of flowSteps) {
      if (s.kind === 'resource') ids.add(s.resourceId);
    }
    return ids;
  }, [flowSteps]);

  const orphanResources = useMemo(
    () => activityResources.filter((r) => !flowResourceIds.has(r.id)),
    [activityResources, flowResourceIds],
  );

  const stepCount = flowSteps.length;

  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
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
            <h3 className="text-base font-semibold leading-snug text-foreground">{section.title}</h3>
            <p className="text-xs text-muted-foreground">
              {stepCount === 0
                ? t('classroomDetail.activities.emptyModuleSummary')
                : stepCount === 1
                  ? t('classroomDetail.activities.stepCountOne')
                  : t('classroomDetail.activities.stepCountMany', { count: stepCount })}
            </p>
          </div>
        </CollapsibleTrigger>
        {open ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="mt-0.5 h-9 w-9 shrink-0 self-start rounded-lg"
                aria-label={t('classroomDetail.activitiesFlow.addNewStep')}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem className="cursor-pointer" onClick={onCreateAssignmentForModule}>
                {t('classroomDetail.activitiesFlow.createAssignment')}
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={onAddActivity}>
                {t('classroomDetail.activitiesFlow.createActivity')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <CollapsibleContent>
        <div className="space-y-3 px-3 pb-4 pt-1 sm:px-4">
          {orphanResources.length > 0 ? (
            <div
              className={cn(
                'rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-950 dark:text-amber-100/90',
                isRTL && 'text-right',
              )}
            >
              <p>
                {t('classroomDetail.activities.notInFlowHint', {
                  count: orphanResources.length,
                })}
              </p>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs text-amber-900 underline dark:text-amber-200"
                onClick={onOpenFlowSheet}
              >
                {t('classroomDetail.curriculum.openFlowToFixOrphans')}
              </Button>
            </div>
          ) : null}

          {flowSteps.length === 0 ? (
            <div className={cn('rounded-lg bg-muted/30 px-3 py-6 text-center', isRTL && 'text-right')}>
              <p className="text-sm text-muted-foreground">{t('classroomDetail.activities.emptyModule')}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {flowSteps.map((step, idx) => {
                const key = step.kind === 'resource' ? `r:${step.resourceId}` : `a:${step.assignmentId}`;
                const r = step.kind === 'resource' ? resourceById[step.resourceId] : undefined;
                const a = step.kind === 'assignment' ? assignmentById[step.assignmentId] : undefined;
                return (
                  <li key={`${key}-${idx}`}>
                    <ModuleFlowStepListItem
                      classroomId={classroomId}
                      sectionId={section.id}
                      step={step}
                      resourceTitle={r?.title}
                      resourceType={r?.resource_type}
                      resourceStatus={r?.status === 'draft' ? 'draft' : 'published'}
                      resourceFilePath={r?.file_path ?? null}
                      assignment={a ?? null}
                      isRTL={isRTL}
                      onEditResource={onEditResource}
                      onEditAssignment={onEditAssignment}
                      onDeleteAssignment={onDeleteAssignment}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
