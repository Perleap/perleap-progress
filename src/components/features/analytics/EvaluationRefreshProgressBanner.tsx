import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type { EvaluationRefreshActiveJob } from '@/contexts/EvaluationRefreshProcessingContext';
import { useEvaluationRefreshProcessing } from '@/contexts/EvaluationRefreshProcessingContext';
import { Button } from '@/components/ui/button';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

type EvaluationRefreshProgressBannerProps = {
  job: EvaluationRefreshActiveJob;
};

export function EvaluationRefreshProgressBanner({ job }: EvaluationRefreshProgressBannerProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { cancelRefresh } = useEvaluationRefreshProcessing();
  const clamped = Math.min(100, Math.max(0, Math.round(job.percent)));

  return (
    <div
      className={cn(
        'fixed bottom-4 z-50 w-[min(100%,28rem)] rounded-xl border border-border bg-background p-4 shadow-lg',
        isRTL ? 'left-4' : 'right-4',
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
      role="status"
      aria-live="polite"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          <span className="truncate">{t('analytics.refreshProgress.title')}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 rounded-lg"
          disabled={job.isCancelling}
          onClick={() => void cancelRefresh()}
        >
          {job.isCancelling
            ? t('analytics.refreshProgress.cancelling')
            : t('analytics.refreshProgress.cancel')}
        </Button>
      </div>
      <Progress
        value={clamped}
        className="w-full flex-col gap-2.5"
        trackClassName="h-2.5 w-full bg-secondary/80"
        indicatorClassName="bg-primary shadow-sm"
      >
        <div className="flex w-full min-w-0 items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <ProgressLabel className="block truncate text-sm font-medium leading-none tracking-tight">
              {job.progressLabel}
            </ProgressLabel>
            {job.etaLabel ? (
              <p className="truncate text-xs leading-relaxed text-muted-foreground">{job.etaLabel}</p>
            ) : null}
          </div>
          <ProgressValue className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
            {t('liveSession.create.progressPercent', { percent: clamped })}
          </ProgressValue>
        </div>
      </Progress>
      <p className="mt-2 text-xs text-muted-foreground">
        {t('analytics.refreshProgress.keepTabOpen')}
      </p>
    </div>
  );
}
