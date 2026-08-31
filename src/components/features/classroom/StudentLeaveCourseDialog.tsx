import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { useUnenrollFromClassroom } from '@/hooks/queries';

export type StudentLeaveCourseDialogProps = {
  classroomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isRTL: boolean;
  onLeft: () => void;
};

export const StudentLeaveCourseDialog = ({
  classroomId,
  open,
  onOpenChange,
  isRTL,
  onLeft,
}: StudentLeaveCourseDialogProps) => {
  const { t } = useTranslation();
  const unenrollMutation = useUnenrollFromClassroom();

  const confirmLeaveCourse = async () => {
    try {
      await unenrollMutation.mutateAsync(classroomId);
      onOpenChange(false);
      onLeft();
    } catch {
      toast.error(t('studentClassroom.leaveCourse.error'));
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'} className="rounded-xl">
        <AlertDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
          <AlertDialogTitle>{t('studentClassroom.leaveCourse.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('studentClassroom.leaveCourse.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={isRTL ? 'flex-row-reverse sm:space-x-reverse' : ''}>
          <AlertDialogCancel className="mt-0" disabled={unenrollMutation.isPending}>
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void confirmLeaveCourse();
            }}
            disabled={unenrollMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {unenrollMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              t('studentClassroom.leaveCourse.confirm')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
