import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { AssignmentTypeIntroContent } from '@/components/features/assignment/AssignmentTypeIntroContent';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { DbAssignmentType } from '@/types/models';

type AssignmentTypeHelpHintProps = {
  assignmentType: DbAssignmentType;
  className?: string;
};

export function AssignmentTypeHelpHint({ assignmentType, className }: AssignmentTypeHelpHintProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={0}
        aria-label={t('assignmentTypeIntro.howToUseHeading')}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          className,
        )}
        render={
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
            }}
          />
        }
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
      </HoverCardTrigger>
      <HoverCardContent
        align={isRTL ? 'end' : 'start'}
        side="bottom"
        sideOffset={8}
        className={cn(
          'pointer-events-none max-h-[60vh] w-72 max-w-sm overflow-y-auto p-3 text-sm',
        )}
      >
        <AssignmentTypeIntroContent assignmentType={assignmentType} variant="hint" />
      </HoverCardContent>
    </HoverCard>
  );
}
