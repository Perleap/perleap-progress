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
import { StudentFacingTaskSection } from '@/components/features/assignment/StudentFacingTaskSection';
import {
  getAssignmentTypeIntroBody,
  getAssignmentTypeIntroTitle,
  getAssignmentTypeTutorial,
} from '@/lib/assignmentTypeIntroCopy';

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

<<<<<<< HEAD
  const taskText = studentFacingTask?.trim() ?? '';
=======
  const title = getAssignmentTypeIntroTitle(t, i18n, assignmentType);
  const body = getAssignmentTypeIntroBody(t, i18n, assignmentType);
  const tutorial = getAssignmentTypeTutorial(t, i18n, assignmentType);

>>>>>>> bugs_during_course
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
              <StudentFacingTaskSection
                assignmentType={assignmentType}
                taskText={studentFacingTask}
                taskLoading={taskLoading}
                variant="plain"
                showHelp={false}
              />
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
