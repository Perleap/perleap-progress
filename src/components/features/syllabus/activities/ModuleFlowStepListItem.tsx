import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, ClipboardList, Eye, FileText, Pencil, Trash2, Video } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import type { ModuleFlowLocalStep } from '@/lib/moduleFlow';
import type { ResourceType } from '@/types/syllabus';
import { cn } from '@/lib/utils';
import { useDeleteResource } from '@/hooks/queries';
import type { ClassroomLocationState } from '@/types/navigation';

type AssignmentLite = {
  id: string;
  title: string;
  status: 'draft' | 'published';
  due_at: string | null;
  type?: string;
};

export interface ModuleFlowStepListItemProps {
  classroomId: string;
  sectionId: string;
  step: ModuleFlowLocalStep;
  resourceTitle?: string;
  resourceType?: ResourceType;
  resourceStatus?: 'draft' | 'published';
  /** For deleting resources (storage cleanup). */
  resourceFilePath?: string | null;
  assignment?: AssignmentLite | null;
  isRTL: boolean;
  onEditResource?: (resourceId: string) => void;
  onEditAssignment?: (assignmentId: string) => void;
  onDeleteAssignment?: (assignmentId: string) => void | Promise<void>;
}

function TypeIcon({ type }: { type: ResourceType }) {
  switch (type) {
    case 'lesson':
      return <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
    case 'video':
      return <Video className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
    case 'text':
    default:
      return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
}

export function ModuleFlowStepListItem({
  classroomId,
  sectionId,
  step,
  resourceTitle,
  resourceType,
  resourceStatus,
  resourceFilePath,
  assignment,
  isRTL,
  onEditResource,
  onEditAssignment,
  onDeleteAssignment,
}: ModuleFlowStepListItemProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const deleteResourceMutation = useDeleteResource();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (step.kind === 'assignment') {
    const title = assignment?.title ?? step.assignmentId;
    const status = assignment?.status ?? 'draft';
    const due = assignment?.due_at;
    const assignmentType = assignment?.type;

    const openSubmissionsForAssignment = () => {
      navigate(`/teacher/classroom/${classroomId}`, {
        state: {
          activeSection: 'submissions',
          submissionsAssignmentId: step.assignmentId,
        } satisfies ClassroomLocationState,
      });
    };

    return (
      <>
        <div
          className={cn(
            'flex min-w-0 items-center gap-3 rounded-lg border border-border/80 bg-card/50 px-3 py-2.5 transition-colors hover:bg-muted/30',
            isRTL && 'flex-row-reverse',
          )}
        >
          <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className={cn('min-w-0 flex-1', isRTL && 'text-right')}>
            <div className="truncate text-sm font-medium text-foreground">{title}</div>
            <div
              className={cn(
                'mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground',
                isRTL && 'justify-end',
              )}
            >
              <span>{t('classroomDetail.activitiesFlow.stepAssignment')}</span>
              {assignmentType ? (
                <span>
                  {t('classroomDetail.type')} {t(`assignmentTypes.${assignmentType}`, assignmentType)}
                </span>
              ) : null}
              {due ? (
                <span>
                  {t('classroomDetail.activities.dueLabel')} {new Date(due).toLocaleDateString()}
                </span>
              ) : null}
            </div>
          </div>
          {status === 'draft' ? (
            <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
              {t('classroomDetail.activities.statusDraft')}
            </Badge>
          ) : null}
          <div className={cn('flex shrink-0 items-center gap-0.5', isRTL && 'flex-row-reverse')}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={t('classroomDetail.activitiesFlow.viewSubmissions')}
              onClick={openSubmissionsForAssignment}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {onEditAssignment ? (
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
            {onDeleteAssignment ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label={t('common.delete')}
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
            <AlertDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
              <AlertDialogTitle>{t('planner.deleteConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('planner.deleteConfirmDescription')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className={isRTL ? 'flex-row-reverse gap-2' : 'gap-2'}>
              <AlertDialogCancel className="mt-0">{t('classroomDetail.deleteDialog.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  setDeleteDialogOpen(false);
                  try {
                    await Promise.resolve(onDeleteAssignment?.(step.assignmentId));
                  } catch {
                    /* parent toasts */
                  }
                }}
              >
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  const title = resourceTitle ?? step.resourceId;
  const type = resourceType ?? 'text';
  const status = resourceStatus ?? 'published';
  const activityPath = `/teacher/classroom/${classroomId}/activity/${step.resourceId}`;
  const linkState = { returnClassroomSection: 'curriculum' as const };

  const typeLabel =
    type === 'video'
      ? t('classroomDetail.activities.typeVideo')
      : type === 'lesson'
        ? t('classroomDetail.activities.typeLesson')
        : t('classroomDetail.activities.typeText');

  const confirmDeleteResource = async () => {
    setDeleteDialogOpen(false);
    try {
      await deleteResourceMutation.mutateAsync({
        resourceId: step.resourceId,
        filePath: resourceFilePath ?? null,
        sectionId,
        classroomId,
      });
      toast.success(t('classroomDetail.activities.deleted'));
    } catch {
      toast.error(t('classroomDetail.activities.deleteFailed'));
    }
  };

  return (
    <>
      <div
        className={cn(
          'flex min-w-0 items-center gap-3 rounded-lg border border-border/80 bg-card/50 px-3 py-2.5 transition-colors hover:bg-muted/30',
          isRTL && 'flex-row-reverse',
        )}
      >
        <TypeIcon type={type} />
        <div className={cn('min-w-0 flex-1', isRTL && 'text-right')}>
          <div className="truncate text-sm font-medium text-foreground">{title}</div>
          <div
            className={cn(
              'mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground',
              isRTL && 'justify-end',
            )}
          >
            <span>{typeLabel}</span>
          </div>
        </div>
        {status === 'draft' ? (
          <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
            {t('classroomDetail.activities.statusDraft')}
          </Badge>
        ) : null}
        <div className={cn('flex shrink-0 items-center gap-0.5', isRTL && 'flex-row-reverse')}>
          <Link
            to={activityPath}
            state={linkState}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon' }),
              'h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground',
            )}
            aria-label={t('classroomDetail.activitiesFlow.viewActivity')}
          >
            <Eye className="h-4 w-4" />
          </Link>
          {onEditResource ? (
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
            className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={t('common.delete')}
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
            <AlertDialogTitle>{t('classroomDetail.activities.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('classroomDetail.activities.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRTL ? 'flex-row-reverse gap-2' : 'gap-2'}>
            <AlertDialogCancel className="mt-0">{t('classroomDetail.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDeleteResource()}
            >
              {t('classroomDetail.activities.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
