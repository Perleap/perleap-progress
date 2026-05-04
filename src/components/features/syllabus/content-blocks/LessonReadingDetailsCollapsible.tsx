import { ChevronDown } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/**
 * Activity / lesson long-form body on the reading (full activity) layout — collapsed by default.
 * Used for rich text, multi-slide text, and plain reading blocks.
 */
export function LessonReadingDetailsCollapsible({
  children,
  className,
  triggerLabel,
}: {
  children: ReactNode;
  className?: string;
  /** When set, overrides the default "Activity details" label */
  triggerLabel?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('w-full min-w-0', className)}
    >
      <CollapsibleTrigger
        type="button"
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-start text-sm font-medium text-foreground shadow-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        <span>{triggerLabel ?? t('activityPage.lessonReadingDetails')}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 opacity-70 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}
