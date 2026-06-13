import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type { LiveSessionActiveJob } from '@/contexts/LiveSessionProcessingContext';
import { LiveSessionCreateProgress } from '@/components/features/liveSession/LiveSessionCreateProgress';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

type LiveSessionProcessingBannerProps = {
  job: LiveSessionActiveJob;
};

export function LiveSessionProcessingBanner({ job }: LiveSessionProcessingBannerProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  return (
    <div
      className={cn(
        'fixed bottom-4 z-50 w-[min(100%,28rem)] rounded-xl border border-border bg-background p-4 shadow-lg',
        isRTL ? 'left-4' : 'right-4'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
      role="status"
      aria-live="polite"
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        <span className="truncate">{t('liveSession.processing.bannerTitle', { title: job.title })}</span>
      </div>
      <LiveSessionCreateProgress
        percent={job.percent}
        label={job.progressLabel}
        transcriptionPhase={job.transcriptionPhase}
        className="border-0 p-0 shadow-none"
      />
      <p className="mt-2 text-xs text-muted-foreground">{t('liveSession.processing.keepTabOpen')}</p>
    </div>
  );
}
