import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { logAdminEvent } from '@/services/adminAuditService';
import { useClassroomResetPreview, useResetClassroom } from '@/hooks/queries';

export type ClassroomResetDialogsProps = {
  classroomId: string;
  isRTL: boolean;
  confirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  assignmentCount: number;
  studentCount: number;
  isAppAdmin?: boolean;
};

export function ClassroomResetDialogs({
  classroomId,
  isRTL,
  confirmOpen,
  onConfirmOpenChange,
  assignmentCount,
  studentCount,
  isAppAdmin,
}: ClassroomResetDialogsProps) {
  const { t } = useTranslation();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const previewEnabled = confirmOpen || resetDialogOpen;
  const { data: resetPreview, isLoading: resetPreviewLoading, isError: resetPreviewError } =
    useClassroomResetPreview(classroomId, previewEnabled);
  const resetClassroomMutation = useResetClassroom();

  const hasResettableData =
    (resetPreview?.active_enrollments ?? studentCount) > 0 || (resetPreview?.submissions ?? 0) > 0;

  const resetTextMatches = resetConfirmText.trim().toLowerCase() === 'confirm';

  const handleResetDialogOpenChange = (open: boolean) => {
    setResetDialogOpen(open);
    if (!open) setResetConfirmText('');
  };

  const handleResetClassroom = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!resetTextMatches) return;

    try {
      const { result } = await resetClassroomMutation.mutateAsync(classroomId);

      if (isAppAdmin) {
        void logAdminEvent({
          action: 'classroom_reset',
          entityType: 'classroom',
          entityId: classroomId,
          metadata: { deleted: result.deleted },
        });
      }

      toast.success(
        t('classroomDetail.resetDialog.success', {
          students: result.deleted.enrollments_unenrolled,
          submissions: result.deleted.submissions,
        }),
      );
      handleResetDialogOpenChange(false);
    } catch (error) {
      console.error('Error resetting classroom:', error);
      toast.error(t('classroomDetail.resetDialog.error'));
    }
  };

  return (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={onConfirmOpenChange}>
        <AlertDialogContent className="rounded-xl max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
            <AlertDialogTitle>{t('classroomDetail.resetDialog.confirmPrompt.title')}</AlertDialogTitle>
            <AlertDialogDescription className={isRTL ? 'text-right' : 'text-left'}>
              {t('classroomDetail.resetDialog.confirmPrompt.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter
            className={isRTL ? 'flex-row-reverse justify-start gap-2' : 'flex-row justify-end gap-2'}
          >
            <AlertDialogCancel className="mt-0">
              {t('classroomDetail.resetDialog.confirmPrompt.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onConfirmOpenChange(false);
                setResetDialogOpen(true);
              }}
              className="bg-amber-600 text-white hover:bg-amber-600/90"
            >
              {t('classroomDetail.resetDialog.confirmPrompt.continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetDialogOpen} onOpenChange={handleResetDialogOpenChange}>
        <AlertDialogContent className="rounded-xl max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
            <AlertDialogTitle>{t('classroomDetail.resetDialog.title')}</AlertDialogTitle>
            <div className={`space-y-4 ${isRTL ? 'text-right' : 'text-left'} text-sm text-muted-foreground`}>
              <p>{t('classroomDetail.resetDialog.description')}</p>

              {resetPreviewLoading ? (
                <p>{t('classroomDetail.resetDialog.previewLoading')}</p>
              ) : resetPreviewError ? (
                <p className="text-destructive">{t('classroomDetail.resetDialog.previewError')}</p>
              ) : (
                <>
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      {t('classroomDetail.resetDialog.willRemoveTitle')}
                    </p>
                    <ul
                      className={`list-disc space-y-1 ${isRTL ? 'list-inside pr-4' : 'list-inside pl-4'}`}
                    >
                      <li>
                        {t('classroomDetail.resetDialog.willRemoveStudents', {
                          count: resetPreview?.active_enrollments ?? studentCount,
                        })}
                      </li>
                      <li>
                        {t('classroomDetail.resetDialog.willRemoveSubmissions', {
                          count: resetPreview?.submissions ?? 0,
                        })}
                      </li>
                      <li>{t('classroomDetail.resetDialog.willRemoveProgress')}</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      {t('classroomDetail.resetDialog.willKeepTitle')}
                    </p>
                    <ul
                      className={`list-disc space-y-1 ${isRTL ? 'list-inside pr-4' : 'list-inside pl-4'}`}
                    >
                      <li>{t('classroomDetail.resetDialog.willKeepCourse')}</li>
                      <li>
                        {t('classroomDetail.resetDialog.willKeepAssignments', {
                          count: resetPreview?.assignments_preserved ?? assignmentCount,
                        })}
                      </li>
                      <li>{t('classroomDetail.resetDialog.willKeepOutline')}</li>
                    </ul>
                  </div>
                </>
              )}

              <div className="space-y-2 pt-2">
                <Label htmlFor="reset-confirm-text">{t('classroomDetail.resetDialog.typeToConfirm')}</Label>
                <Input
                  id="reset-confirm-text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder={t('classroomDetail.resetDialog.confirmPlaceholder')}
                  autoComplete="off"
                  disabled={resetClassroomMutation.isPending}
                />
                {resetConfirmText.trim().length > 0 && !resetTextMatches && (
                  <p className="text-xs text-destructive">
                    {t('classroomDetail.resetDialog.confirmMismatch')}
                  </p>
                )}
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter
            className={isRTL ? 'flex-row-reverse justify-start gap-2' : 'flex-row justify-end gap-2'}
          >
            <AlertDialogCancel disabled={resetClassroomMutation.isPending} className="mt-0">
              {t('classroomDetail.resetDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetClassroom}
              disabled={
                resetClassroomMutation.isPending ||
                resetPreviewLoading ||
                resetPreviewError ||
                !resetTextMatches ||
                !hasResettableData
              }
              className="bg-amber-600 text-white hover:bg-amber-600/90"
            >
              {resetClassroomMutation.isPending
                ? t('classroomDetail.resetDialog.resetting')
                : t('classroomDetail.resetDialog.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
