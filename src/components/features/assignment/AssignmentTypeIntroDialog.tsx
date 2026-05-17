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
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { DbAssignmentType } from '@/types/models';

type AssignmentTypeIntroDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentType: DbAssignmentType;
  assignmentTitle?: string | null;
};

export function AssignmentTypeIntroDialog({
  open,
  onOpenChange,
  assignmentType,
  assignmentTitle,
}: AssignmentTypeIntroDialogProps) {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();

  const titleKey = `assignmentTypeIntro.${assignmentType}.title`;
  const bodyKey = `assignmentTypeIntro.${assignmentType}.body`;
  const tutorialKey = `assignmentTypeIntro.${assignmentType}.tutorial`;
  const title = i18n.exists(titleKey) ? t(titleKey) : t('assignmentTypeIntro.fallback.title');
  const body = i18n.exists(bodyKey) ? t(bodyKey) : t('assignmentTypeIntro.fallback.body');
  const tutorial = i18n.exists(tutorialKey)
    ? t(tutorialKey)
    : t('assignmentTypeIntro.fallback.tutorial');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn('max-h-[85vh] overflow-y-auto', isRTL && 'text-end')}
        dir={isRTL ? 'rtl' : 'ltr'}
        showCloseButton
      >
        <DialogHeader className={cn(isRTL && 'text-end')}>
          <DialogTitle>{title}</DialogTitle>
          {assignmentTitle?.trim() ? (
            <p className="text-muted-foreground text-sm font-normal">{assignmentTitle.trim()}</p>
          ) : null}
          <DialogDescription
            className={cn(
              'leading-relaxed whitespace-pre-wrap',
              isRTL ? 'text-end' : 'text-start',
            )}
          >
            {body}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'space-y-2 border-t border-border/60 pt-4',
            isRTL && 'text-end',
          )}
        >
          <h3 className="text-sm font-medium text-foreground">
            {t('assignmentTypeIntro.howToUseHeading')}
          </h3>
          <DialogDescription
            className={cn(
              'text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground',
              isRTL ? 'text-end' : 'text-start',
            )}
          >
            {tutorial}
          </DialogDescription>
        </div>

        <DialogFooter className={cn(isRTL && 'sm:flex-row-reverse')}>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t('assignmentTypeIntro.continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
