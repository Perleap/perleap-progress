import { useTranslation } from 'react-i18next';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { LiveSession } from '@/types/liveSession';

export const LIVE_SESSION_PROCESSING_STATUSES = new Set(['extracted', 'transcribing']);

export function isLiveSessionProcessing(status: LiveSession['status']): boolean {
  return LIVE_SESSION_PROCESSING_STATUSES.has(status);
}

export type LiveSessionStatusBannerProps = {
  session: LiveSession;
  isProcessing: boolean;
  isFailed: boolean;
  hasUploadedAudio: boolean;
  onRetry: () => void | Promise<void>;
};

export function LiveSessionStatusBanner({
  session,
  isProcessing,
  isFailed,
  hasUploadedAudio,
  onRetry,
}: LiveSessionStatusBannerProps) {
  const { t } = useTranslation();

  if (!isProcessing && !isFailed) return null;

  return (
    <>
      {isProcessing ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium">{t('liveSession.status.processing')}</p>
              <p className="text-sm text-muted-foreground">
                {t(`liveSession.status.${session.status}`)}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isFailed ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center justify-between gap-3 py-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium">{t('liveSession.status.failed')}</p>
                {session.error ? (
                  <p className="text-sm text-muted-foreground">{session.error}</p>
                ) : null}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasUploadedAudio}
              onClick={() => void onRetry()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {t('liveSession.status.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
