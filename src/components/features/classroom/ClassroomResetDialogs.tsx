import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ResetPreviewSummary } from './ResetPreviewSummary';
import { matchesTypedConfirm, TypedConfirmInput } from '@/components/shared/TypedConfirmInput';
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
import { useClassroomResetPreview, useResetClassroom } from '@/hooks/queries';
import { logAdminEvent } from '@/services/adminAuditService';

export type ClassroomResetDialogsProps = {
  classroomId: string;
  classroomName: string;
  isRTL: boolean;
  confirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  assignmentCount: number;
  studentCount: number;
  isAppAdmin?: boolean;
};

export const ClassroomResetDialogs = ({
  classroomId,
  classroomName,
  isRTL,
  confirmOpen,
  onConfirmOpenChange,
  assignmentCount,
  studentCount,
  isAppAdmin,
}: ClassroomResetDialogsProps) => {
  const { t } = useTranslation();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const previewEnabled = confirmOpen || resetDialogOpen;
  const {
    data: resetPreview,
    isLoading: resetPreviewLoading,
    isError: resetPreviewError,
  } = useClassroomResetPreview(classroomId, previewEnabled);
  const resetClassroomMutation = useResetClassroom();

  const hasResettableData =
    (resetPreview?.active_enrollments ?? studentCount) > 0 || (resetPreview?.submissions ?? 0) > 0;

  const resetTextMatches = matchesTypedConfirm(resetConfirmText, classroomName);

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
        })
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
            <AlertDialogTitle>
              {t('classroomDetail.resetDialog.confirmPrompt.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className={isRTL ? 'text-right' : 'text-left'}>
              {t('classroomDetail.resetDialog.confirmPrompt.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter
            className={
              isRTL ? 'flex-row-reverse justify-start gap-2' : 'flex-row justify-end gap-2'
            }
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
            <div
              className={`space-y-4 ${isRTL ? 'text-right' : 'text-left'} text-sm text-muted-foreground`}
            >
              <p>{t('classroomDetail.resetDialog.description')}</p>

              <ResetPreviewSummary
                resetPreview={resetPreview ?? undefined}
                resetPreviewLoading={resetPreviewLoading}
                resetPreviewError={resetPreviewError}
                studentCount={studentCount}
                assignmentCount={assignmentCount}
                isRTL={isRTL}
                t={t}
              />

              <div className="pt-2">
                <TypedConfirmInput
                  id="reset-confirm-text"
                  value={resetConfirmText}
                  onChange={setResetConfirmText}
                  expectedText={classroomName}
                  label={t('classroomDetail.resetDialog.typeToConfirm')}
                  placeholder={t('classroomDetail.resetDialog.confirmPlaceholder')}
                  mismatchMessage={t('classroomDetail.resetDialog.confirmMismatch')}
                  disabled={resetClassroomMutation.isPending}
                  isRTL={isRTL}
                />
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter
            className={
              isRTL ? 'flex-row-reverse justify-start gap-2' : 'flex-row justify-end gap-2'
            }
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
};
