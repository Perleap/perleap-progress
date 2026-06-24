import { useState } from 'react';
import { ChevronDown, HelpCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { clipboardZoneProps } from '@/lib/clipboardSourceResolution';
import { getAssignmentTypeTutorial } from '@/lib/assignmentTypeIntroCopy';
import { cn } from '@/lib/utils';
import type { DbAssignmentType } from '@/types/models';

type StudentFacingTaskSectionProps = {
  assignmentType: DbAssignmentType;
  taskText?: string | null;
  taskLoading?: boolean;
  className?: string;
  variant?: 'collapsible' | 'plain';
  /** When false, hide the help tooltip (e.g. inside a modal that already showed tutorial). */
  showHelp?: boolean;
};

function TaskHelpTooltip({
  tutorial,
  isRTL,
  ariaLabel,
  heading,
}: {
  tutorial: string;
  isRTL: boolean;
  ariaLabel: string;
  heading: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align={isRTL ? 'end' : 'start'}
        sideOffset={6}
        className="max-w-[min(20rem,calc(100vw-2rem))] px-3 py-2.5 text-start text-sm leading-relaxed whitespace-pre-wrap"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <p className="mb-1 font-medium">{heading}</p>
        <p className="font-normal opacity-90">{tutorial}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function TaskBody({
  taskLoading,
  trimmedTask,
  isRTL,
  t,
}: {
  taskLoading: boolean;
  trimmedTask: string;
  isRTL: boolean;
  t: (key: string) => string;
}) {
  if (taskLoading) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground" dir="auto">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        {t('assignmentDetail.loadingStudentTask')}
      </p>
    );
  }

  if (trimmedTask) {
    return (
      <p
        className={cn(
          'whitespace-pre-wrap leading-relaxed text-foreground',
          isRTL ? 'text-end' : 'text-start',
        )}
        dir="auto"
        {...clipboardZoneProps({ sourceKind: 'student_facing_task' })}
      >
        {trimmedTask}
      </p>
    );
  }

  return (
    <p className="text-muted-foreground leading-relaxed" dir="auto">
      {t('assignmentDetail.studentTaskNotSetYet')}
    </p>
  );
}

export function StudentFacingTaskSection({
  assignmentType,
  taskText,
  taskLoading = false,
  className,
  variant = 'collapsible',
  showHelp = true,
}: StudentFacingTaskSectionProps) {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [open, setOpen] = useState(false);

  const trimmedTask = taskText?.trim() ?? '';
  const tutorial = getAssignmentTypeTutorial(t, i18n, assignmentType);
  const helpAria = t('assignmentDetail.studentTaskHelpAria');
  const helpHeading = t('assignmentTypeIntro.howToUseHeading');

  if (variant === 'plain') {
    return (
      <section
        className={cn('space-y-2 text-sm', isRTL && 'text-end', className)}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className={cn('flex items-center gap-1.5', isRTL && 'flex-row-reverse justify-end')}>
          <h3 className="text-sm font-medium text-foreground">{t('assignmentDetail.studentTaskTitle')}</h3>
          {showHelp ? (
            <TaskHelpTooltip
              tutorial={tutorial}
              isRTL={isRTL}
              ariaLabel={helpAria}
              heading={helpHeading}
            />
          ) : null}
        </div>
        <TaskBody taskLoading={taskLoading} trimmedTask={trimmedTask} isRTL={isRTL} t={t} />
      </section>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        'overflow-hidden rounded-lg border border-border/60 bg-muted/5 text-sm',
        className,
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className={cn('flex w-full items-center', isRTL && 'flex-row-reverse')}>
        <CollapsibleTrigger
          className={cn(
            'flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5 text-start outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/50',
            isRTL ? 'text-end' : 'text-start',
          )}
        >
          <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
            {t('assignmentDetail.studentTaskTitle')}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </CollapsibleTrigger>
        {showHelp ? (
          <span className={cn('flex shrink-0 items-center', isRTL ? 'ps-3' : 'pe-3')}>
            <TaskHelpTooltip
              tutorial={tutorial}
              isRTL={isRTL}
              ariaLabel={helpAria}
              heading={helpHeading}
            />
          </span>
        ) : null}
      </div>
      <CollapsibleContent className="border-t border-border/50 px-3 pb-3 pt-2 text-sm">
        <TaskBody taskLoading={taskLoading} trimmedTask={trimmedTask} isRTL={isRTL} t={t} />
      </CollapsibleContent>
    </Collapsible>
  );
}
