import { useTranslation } from 'react-i18next';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { TranscriptionProgressUpdate } from '@/services/liveSessionService';

interface LiveSessionCreateProgressProps {
  percent: number;
  label: string;
  transcriptionPhase?: TranscriptionProgressUpdate['phase'] | null;
  className?: string;
}

export function LiveSessionCreateProgress({
  percent,
  label,
  transcriptionPhase,
  className,
}: LiveSessionCreateProgressProps) {
  const { t } = useTranslation();
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));

  const phaseHint =
    transcriptionPhase === 'transcribing'
      ? t('liveSession.create.progressPhaseTranscript')
      : transcriptionPhase === 'summarizing'
        ? t('liveSession.create.progressPhaseSummary')
        : transcriptionPhase === 'finishing'
          ? t('liveSession.create.progressPhaseFinishing')
          : null;

  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border border-border/80 bg-card p-4 shadow-sm',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Progress
        value={clamped}
        className="w-full flex-col gap-2.5"
        trackClassName="h-2.5 w-full bg-secondary/80"
        indicatorClassName="bg-primary shadow-sm"
      >
        <div className="flex w-full min-w-0 items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <ProgressLabel className="block truncate text-sm font-medium leading-none tracking-tight">
              {label}
            </ProgressLabel>
            {phaseHint ? (
              <p className="truncate text-xs leading-relaxed text-muted-foreground">{phaseHint}</p>
            ) : null}
          </div>
          <ProgressValue className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
            {t('liveSession.create.progressPercent', { percent: clamped })}
          </ProgressValue>
        </div>
      </Progress>
    </div>
  );
}
