import { Clock } from 'lucide-react';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { LiveSession } from '@/types/liveSession';
import {
  LiveSessionAudioPlayback,
  type LiveSessionAudioPlaybackHandle,
} from '@/components/features/liveSession/LiveSessionAudioPlayback';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export type LiveSessionReadyPanelProps = {
  session: LiveSession;
  audioStoragePaths: string[];
  isRTL: boolean;
  onSeek: (seconds: number) => void;
};

export const LiveSessionReadyPanel = forwardRef<
  LiveSessionAudioPlaybackHandle,
  LiveSessionReadyPanelProps
>(({ session, audioStoragePaths, isRTL, onSeek }, ref) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {audioStoragePaths.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('liveSession.audio.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <LiveSessionAudioPlayback
              ref={ref}
              storagePaths={audioStoragePaths}
              durationSeconds={session.duration_seconds}
            />
          </CardContent>
        </Card>
      ) : null}

      {session.summary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('liveSession.summary.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {session.summary}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {session.timestamps.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('liveSession.timestamps.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {session.timestamps.map((ts, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSeek(ts.time)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted',
                  isRTL && 'flex-row-reverse text-end'
                )}
              >
                <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-primary">
                  <Clock className="h-3 w-3" />
                  {formatTime(ts.time)}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{ts.label}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {session.transcript ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('liveSession.transcript.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {session.transcript}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
});
