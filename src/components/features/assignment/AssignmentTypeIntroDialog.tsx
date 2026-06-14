import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AssignmentTypeIntroContent } from '@/components/features/assignment/AssignmentTypeIntroContent';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { DbAssignmentType } from '@/types/models';
import { Loader2 } from 'lucide-react';

type WizardStep = 'type' | 'task';

type AssignmentTypeIntroDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentType: DbAssignmentType;
  assignmentTitle?: string | null;
  /** When true, open directly on the task-understanding step (type intro already seen). */
  skipTypeStep?: boolean;
  studentFacingTask?: string | null;
  taskLoading?: boolean;
  onTypeStepComplete?: () => void;
  onTaskConfirm: (understood: boolean) => void;
};

export function AssignmentTypeIntroDialog({
  open,
  onOpenChange,
  assignmentType,
  assignmentTitle,
  skipTypeStep = false,
  studentFacingTask,
  taskLoading = false,
  onTypeStepComplete,
  onTaskConfirm,
}: AssignmentTypeIntroDialogProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [step, setStep] = useState<WizardStep>(skipTypeStep ? 'task' : 'type');

  useEffect(() => {
    if (open) {
      setStep(skipTypeStep ? 'task' : 'type');
    }
  }, [open, skipTypeStep]);

  const taskText = studentFacingTask?.trim() ?? '';
  const taskReady = !taskLoading;

  const handleOpenChange = (next: boolean) => {
    if (!next && step === 'type') {
      onTypeStepComplete?.();
      setStep('task');
      return;
    }
    if (!next && step === 'task') {
      return;
    }
    onOpenChange(next);
  };

  const handleTypeContinue = () => {
    onTypeStepComplete?.();
    setStep('task');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn('max-h-[85vh] overflow-y-auto', isRTL && 'text-end')}
        dir={isRTL ? 'rtl' : 'ltr'}
        showCloseButton={step === 'type'}
      >
        {step === 'type' ? (
          <>
            <AssignmentTypeIntroContent
              assignmentType={assignmentType}
              assignmentTitle={assignmentTitle}
              variant="dialog"
            />

            <DialogFooter className={cn(isRTL && 'sm:flex-row-reverse')}>
              <Button type="button" onClick={handleTypeContinue}>
                {t('assignmentTypeIntro.continue')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className={cn(isRTL && 'text-end')}>
              <DialogTitle>{t('taskUnderstanding.taskStepTitle')}</DialogTitle>
              {assignmentTitle?.trim() ? (
                <p className="text-muted-foreground text-sm font-normal">{assignmentTitle.trim()}</p>
              ) : null}
            </DialogHeader>

            <div className={cn('space-y-3', isRTL && 'text-end')}>
              <h3 className="text-sm font-medium text-foreground">
                {t('assignmentDetail.studentTaskTitle')}
              </h3>
              {taskLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground" dir="auto">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  {t('assignmentDetail.loadingStudentTask')}
                </p>
              ) : taskText ? (
                <p
                  className={cn(
                    'text-sm leading-relaxed whitespace-pre-wrap text-foreground',
                    isRTL ? 'text-end' : 'text-start',
                  )}
                  dir="auto"
                >
                  {taskText}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed" dir="auto">
                  {t('assignmentDetail.studentTaskNotSetYet')}
                </p>
              )}
              <p className="text-sm font-medium text-foreground">{t('taskUnderstanding.question')}</p>
            </div>

            <DialogFooter
              className={cn(
                'gap-2 sm:gap-2',
                isRTL ? 'sm:flex-row-reverse' : 'sm:flex-row',
              )}
            >
              <Button
                type="button"
                variant="outline"
                disabled={!taskReady}
                onClick={() => {
                  onTaskConfirm(false);
                  onOpenChange(false);
                }}
              >
                {t('taskUnderstanding.no')}
              </Button>
              <Button
                type="button"
                disabled={!taskReady}
                onClick={() => {
                  onTaskConfirm(true);
                  onOpenChange(false);
                }}
              >
                {t('taskUnderstanding.yes')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
