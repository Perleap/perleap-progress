import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StudentModuleOutlineRailProps {
  flowStepIndex: number;
  showFlowCheck: boolean;
  highlightInProgress: boolean;
  unlocked: boolean;
  isRTL: boolean;
}

/** Left column: numbered circle (or check); no vertical connector line. */
export function StudentModuleOutlineRail({
  flowStepIndex,
  showFlowCheck,
  highlightInProgress,
  unlocked,
  isRTL,
}: StudentModuleOutlineRailProps) {
  return (
    <div
      className={cn(
        'flex w-11 shrink-0 flex-col items-center border-border/50 px-1 pt-3 pb-1',
        isRTL ? 'border-s' : 'border-e',
      )}
      aria-hidden
    >
      <div
        className={cn(
          'relative z-[1] flex h-8 w-8 items-center justify-center rounded-full border-2 bg-card text-xs font-semibold tabular-nums text-foreground',
          showFlowCheck && 'border-muted-foreground/40 bg-muted/50 text-muted-foreground',
          highlightInProgress && !showFlowCheck && unlocked && 'border-primary ring-2 ring-primary/25 ring-offset-2 ring-offset-card',
          !unlocked && 'opacity-60',
        )}
      >
        {showFlowCheck ? (
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
        ) : (
          flowStepIndex + 1
        )}
      </div>
    </div>
  );
}
