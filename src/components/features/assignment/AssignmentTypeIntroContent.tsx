import { useTranslation } from 'react-i18next';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAssignmentTypeIntroContent } from '@/lib/assignmentTypeIntroContent';
import { cn } from '@/lib/utils';
import type { DbAssignmentType } from '@/types/models';

type AssignmentTypeIntroContentProps = {
  assignmentType: DbAssignmentType;
  assignmentTitle?: string | null;
  className?: string;
  variant?: 'dialog' | 'hint';
};

export function AssignmentTypeIntroContent({
  assignmentType,
  assignmentTitle,
  className,
  variant = 'dialog',
}: AssignmentTypeIntroContentProps) {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const { title, body, tutorial } = getAssignmentTypeIntroContent(assignmentType, t, i18n);

  const textAlign = isRTL ? 'text-end' : 'text-start';

  if (variant === 'dialog') {
    return (
      <>
        <DialogHeader className={cn(isRTL && 'text-end', textAlign, className)}>
          <DialogTitle>{title}</DialogTitle>
          {assignmentTitle?.trim() ? (
            <p className="text-muted-foreground text-sm font-normal">{assignmentTitle.trim()}</p>
          ) : null}
          <DialogDescription
            className={cn('leading-relaxed whitespace-pre-wrap', textAlign)}
          >
            {body}
          </DialogDescription>
        </DialogHeader>

        <div className={cn('space-y-2 border-t border-border/60 pt-4', isRTL && 'text-end', textAlign)}>
          <h3 className="text-sm font-medium text-foreground">
            {t('assignmentTypeIntro.howToUseHeading')}
          </h3>
          <DialogDescription
            className={cn(
              'text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground',
              textAlign,
            )}
          >
            {tutorial}
          </DialogDescription>
        </div>
      </>
    );
  }

  return (
    <div
      className={cn('space-y-3', textAlign, className)}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className={cn('leading-relaxed whitespace-pre-wrap text-foreground', textAlign)}>
          {body}
        </p>
      </div>

      <div className={cn('space-y-2 border-t border-border/60 pt-3', textAlign)}>
        <h4 className="text-sm font-medium text-foreground">
          {t('assignmentTypeIntro.howToUseHeading')}
        </h4>
        <p
          className={cn(
            'text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground',
            textAlign,
          )}
        >
          {tutorial}
        </p>
      </div>
    </div>
  );
}
