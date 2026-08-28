import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { logAdminEvent } from '@/services/adminAuditService';
import { useSoftDeleteClassroom } from '@/hooks/queries';

export type ClassroomDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroomId: string;
  classroomName: string;
  assignmentCount: number;
  studentCount: number;
  isRTL: boolean;
  restrictToTeacherId?: string;
  isAppAdmin?: boolean;
  onDeleted?: () => void;
};

export function ClassroomDeleteDialog({
  open,
  onOpenChange,
  classroomId,
  classroomName,
  assignmentCount,
  studentCount,
  isRTL,
  restrictToTeacherId,
  isAppAdmin,
  onDeleted,
}: ClassroomDeleteDialogProps) {
  const { t } = useTranslation();
  const deleteMutation = useSoftDeleteClassroom();
  const isDeleting = deleteMutation.isPending;

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ classroomId, restrictToTeacherId });

      if (isAppAdmin) {
        void logAdminEvent({
          action: 'classroom_soft_delete',
          entityType: 'classroom',
          entityId: classroomId,
        });
      }

      toast.success(t('classroomDetail.success.deleted'));
      onOpenChange(false);
      onDeleted?.();
    } catch (error) {
      const message =
        error instanceof Error && error.message === 'Classroom not deleted'
          ? t('classroomDetail.errors.deleting')
          : error instanceof Error
            ? error.message
            : t('classroomDetail.errors.deleting');
      console.error('Error deleting classroom:', message);
      toast.error(message);
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
        <AlertDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
          <AlertDialogTitle>{t('classroomDetail.deleteDialog.title')}</AlertDialogTitle>
          <div className={`space-y-2 ${isRTL ? 'text-right' : 'text-left'} text-sm text-muted-foreground`}>
            <p>{t('classroomDetail.deleteDialog.description')}</p>
            <ul className={`list-disc space-y-1 text-sm ${isRTL ? 'list-inside pr-4' : 'list-inside pl-4'}`}>
              <li>
                <strong>{assignmentCount}</strong>{' '}
                {assignmentCount !== 1
                  ? t('classroomDetail.deleteDialog.assignmentCountPlural')
                  : t('classroomDetail.deleteDialog.assignmentCount')}
              </li>
              <li>
                <strong>{studentCount}</strong>{' '}
                {studentCount !== 1
                  ? t('classroomDetail.deleteDialog.studentCountPlural')
                  : t('classroomDetail.deleteDialog.studentCount')}
              </li>
              <li>{t('classroomDetail.deleteDialog.allSubmissions')}</li>
              <li>{t('classroomDetail.deleteDialog.allAnalytics')}</li>
            </ul>
            <p className="font-semibold text-destructive mt-4">
              {t('classroomDetail.deleteDialog.classroomLabel')} {classroomName}
            </p>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter
          className={isRTL ? 'flex-row-reverse justify-start gap-2' : 'flex-row justify-end gap-2'}
        >
          <AlertDialogCancel disabled={isDeleting} className="mt-0">
            {t('classroomDetail.deleteDialog.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting
              ? t('classroomDetail.deleteDialog.deleting')
              : t('classroomDetail.deleteDialog.deleteButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
