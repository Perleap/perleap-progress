import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export type SubmissionResetProgressDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isPending: boolean;
};

export const SubmissionResetProgressDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: SubmissionResetProgressDialogProps) => {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full border-border shadow-sm hover:shadow-md transition-all text-sm h-9 px-4"
        >
          <RotateCcw className="me-2 h-3.5 w-3.5" />
          {t('submissionDetail.resetStudentProgress.action')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent size="default" className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('submissionDetail.resetStudentProgress.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('submissionDetail.resetStudentProgress.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            disabled={isPending}
          >
            {isPending ? t('common.loading') : t('submissionDetail.resetStudentProgress.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
