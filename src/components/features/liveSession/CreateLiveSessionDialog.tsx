import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { assignmentKeys } from '@/hooks/queries/useAssignmentQueries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, Video, Music } from 'lucide-react';
import { LiveSessionCreateProgress } from '@/components/features/liveSession/LiveSessionCreateProgress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { LIVE_SESSION_TYPES, type LiveSessionType } from '@/types/liveSession';
import {
  mapExtractProgressToPercent,
  prepareAudioBlobsForUpload,
  probeVideoFileForWarning,
  shouldShowLongRecordingWarning,
} from '@/lib/liveSessionExtractAudio';
import {
  createLiveSession,
  startLiveSessionTranscriptionWithProgress,
  uploadLiveSessionAudio,
  type TranscriptionProgressUpdate,
} from '@/services/liveSessionService';

export type LiveSessionUploadMode = 'video' | 'audio';

interface CreateLiveSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroomId: string;
  syllabusSectionId?: string | null;
  /** Fired as soon as the assignment row exists — add to module flow before upload/transcribe. */
  onAssignmentCreated?: (assignmentId: string) => void;
  onCreated: (assignmentId: string) => void;
}

export function CreateLiveSessionDialog({
  open,
  onOpenChange,
  classroomId,
  syllabusSectionId,
  onAssignmentCreated,
  onCreated,
}: CreateLiveSessionDialogProps) {
  const { t } = useTranslation();
  const { isRTL, language } = useLanguage();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState<LiveSessionType>('workshop');
  const [uploadMode, setUploadMode] = useState<LiveSessionUploadMode>('video');
  const [file, setFile] = useState<File | null>(null);
  const [longRecordingWarning, setLongRecordingWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [transcriptionPhase, setTranscriptionPhase] = useState<
    TranscriptionProgressUpdate['phase'] | null
  >(null);
  const [videoProbeMeta, setVideoProbeMeta] = useState<{
    durationSeconds: number;
    fileSizeMb: number;
  } | null>(null);

  const setOverallProgress = (percent: number, label: string) => {
    setProgressPercent(Math.min(100, Math.max(0, Math.round(percent))));
    setProgressLabel(label);
  };

  useEffect(() => {
    if (open) {
      setTitle('');
      setSessionType('workshop');
      setUploadMode('video');
      setFile(null);
      setLongRecordingWarning(false);
      setSubmitting(false);
      setProgressLabel('');
      setProgressPercent(0);
      setTranscriptionPhase(null);
      setVideoProbeMeta(null);
    }
  }, [open]);

  useEffect(() => {
    if (!file || uploadMode !== 'video') {
      setVideoProbeMeta(null);
      setLongRecordingWarning(false);
      return;
    }
    const ac = new AbortController();
    void probeVideoFileForWarning(file, ac.signal).then((meta) => {
      if (ac.signal.aborted || !meta) {
        setVideoProbeMeta(null);
        setLongRecordingWarning(false);
        return;
      }
      setVideoProbeMeta(meta);
      setLongRecordingWarning(shouldShowLongRecordingWarning(meta));
    });
    return () => ac.abort();
  }, [file, uploadMode]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error(t('liveSession.create.titleRequired'));
      return;
    }
    if (!file) {
      toast.error(t('liveSession.create.fileRequired'));
      return;
    }

    setSubmitting(true);
    setProgressPercent(0);
    setTranscriptionPhase(null);
    try {
      setOverallProgress(3, t('liveSession.create.creating'));
      const created = await createLiveSession({
        classroomId,
        syllabusSectionId: syllabusSectionId ?? null,
        title: title.trim(),
        sessionType,
      });
      if ('error' in created) {
        throw new Error(created.error.message);
      }

      await queryClient.invalidateQueries({
        queryKey: assignmentKeys.classroomAssignmentLists(classroomId),
        exact: false,
      });
      onAssignmentCreated?.(created.assignmentId);

      let blobs: Blob[];
      let durationSeconds: number | null = null;

      if (uploadMode === 'video') {
        setOverallProgress(5, t('liveSession.create.converting'));
        const extracted = await prepareAudioBlobsForUpload(
          file,
          'video',
          (p) => {
            const extractPct = mapExtractProgressToPercent(p);
            setOverallProgress(5 + extractPct * 0.7, t('liveSession.create.converting'));
          },
          { knownDurationSeconds: videoProbeMeta?.durationSeconds }
        );
        blobs = extracted.blobs;
        durationSeconds = extracted.durationSeconds > 0 ? extracted.durationSeconds : null;
      } else {
        setOverallProgress(10, t('liveSession.create.preparing'));
        const prepared = await prepareAudioBlobsForUpload(file, 'audio', (p) => {
          const extractPct = mapExtractProgressToPercent(p);
          setOverallProgress(5 + extractPct * 0.7, t('liveSession.create.preparing'));
        });
        blobs = prepared.blobs;
        durationSeconds = prepared.durationSeconds > 0 ? prepared.durationSeconds : null;
      }

      setOverallProgress(82, t('liveSession.create.uploading'));
      const uploaded = await uploadLiveSessionAudio(created.liveSessionId, blobs, durationSeconds);
      if ('error' in uploaded) {
        throw new Error(uploaded.error.message);
      }

      const lang = language === 'he' ? 'he' : 'en';
      const { error: transcribeError } = await startLiveSessionTranscriptionWithProgress(
        created.liveSessionId,
        lang,
        {
          audioChunkCount: blobs.length,
          durationSeconds,
          onProgress: (update) => {
            setTranscriptionPhase(update.phase);
            const label =
              update.phase === 'transcribing'
                ? t('liveSession.create.transcribing')
                : update.phase === 'summarizing'
                  ? t('liveSession.create.summarizing')
                  : update.phase === 'finishing'
                    ? t('liveSession.create.transcriptReady')
                    : t('liveSession.create.transcribing');
            setOverallProgress(update.percent, label);
          },
        }
      );
      if (transcribeError) {
        throw new Error(transcribeError.message);
      }

      setTranscriptionPhase('finishing');
      setOverallProgress(100, t('liveSession.create.transcriptReady'));
      toast.success(t('liveSession.create.success'));
      onCreated(created.assignmentId);
      onOpenChange(false);
    } catch (error) {
      console.error('createLiveSession error', error);
      const message = error instanceof Error ? error.message : '';
      toast.error(
        message.toLowerCase().includes('ffmpeg') || message.toLowerCase().includes('load')
          ? t('liveSession.create.conversionError')
          : t('liveSession.create.error')
      );
    } finally {
      setSubmitting(false);
      setProgressLabel('');
      setProgressPercent(0);
      setTranscriptionPhase(null);
    }
  };

  const fileAccept = uploadMode === 'video' ? 'video/*' : 'audio/*';
  const filePlaceholder =
    uploadMode === 'video'
      ? t('liveSession.create.filePlaceholderVideo')
      : t('liveSession.create.filePlaceholderAudio');
  const fileHint =
    uploadMode === 'video'
      ? t('liveSession.create.fileHintVideo')
      : t('liveSession.create.fileHintAudio');

  return (
    <Dialog open={open} onOpenChange={(next) => (submitting ? undefined : onOpenChange(next))}>
      <DialogContent
        className={cn(
          'min-w-0 max-h-[min(90vh,720px)] overflow-x-hidden overflow-y-auto',
          isRTL && 'text-end'
        )}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader className={cn(isRTL && 'text-end')}>
          <DialogTitle>{t('liveSession.create.title')}</DialogTitle>
          <DialogDescription>{t('liveSession.create.description')}</DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="live-session-title">{t('liveSession.create.titleLabel')}</Label>
            <Input
              id="live-session-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          <div className="min-w-0 space-y-2">
            <Label>{t('liveSession.create.typeLabel')}</Label>
            <div className="grid min-w-0 grid-cols-3 gap-2">
              {LIVE_SESSION_TYPES.map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={sessionType === type ? 'default' : 'outline'}
                  className="h-auto min-w-0 w-full whitespace-normal px-2 py-2 text-xs sm:text-sm"
                  disabled={submitting}
                  onClick={() => setSessionType(type)}
                >
                  {t(`liveSession.types.${type}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <Label>{t('liveSession.create.uploadModeLabel')}</Label>
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={uploadMode === 'video' ? 'default' : 'outline'}
                className="h-auto min-w-0 w-full gap-2 whitespace-normal px-2 py-2 text-xs sm:text-sm"
                disabled={submitting}
                onClick={() => {
                  setUploadMode('video');
                  setFile(null);
                }}
              >
                <Video className="h-4 w-4 shrink-0" />
                {t('liveSession.create.uploadModeVideo')}
              </Button>
              <Button
                type="button"
                variant={uploadMode === 'audio' ? 'default' : 'outline'}
                className="h-auto min-w-0 w-full gap-2 whitespace-normal px-2 py-2 text-xs sm:text-sm"
                disabled={submitting}
                onClick={() => {
                  setUploadMode('audio');
                  setFile(null);
                }}
              >
                <Music className="h-4 w-4 shrink-0" />
                {t('liveSession.create.uploadModeAudio')}
              </Button>
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <Label htmlFor="live-session-file">{t('liveSession.create.fileLabel')}</Label>
            <label
              htmlFor="live-session-file"
              className={cn(
                'flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-muted/50',
                submitting && 'pointer-events-none opacity-60'
              )}
            >
              {file ? (
                uploadMode === 'video' ? (
                  <Video className="h-5 w-5 shrink-0" />
                ) : (
                  <Music className="h-5 w-5 shrink-0" />
                )
              ) : (
                <Upload className="h-5 w-5 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate">{file ? file.name : filePlaceholder}</span>
            </label>
            <input
              id="live-session-file"
              key={uploadMode}
              type="file"
              accept={fileAccept}
              className="hidden"
              disabled={submitting}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">{fileHint}</p>
            {longRecordingWarning ? (
              <Alert
                variant="default"
                className="border-amber-200 bg-amber-50 dark:bg-amber-950/30"
              >
                <AlertDescription className="text-sm text-amber-900 dark:text-amber-100">
                  {t('liveSession.create.longRecordingWarning')}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        </div>

        {submitting ? (
          <LiveSessionCreateProgress
            percent={progressPercent}
            label={progressLabel || t('liveSession.create.creating')}
            transcriptionPhase={transcriptionPhase}
          />
        ) : null}

        <DialogFooter className={cn(isRTL && 'sm:flex-row-reverse')}>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting} className="gap-2">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {progressLabel || t('liveSession.create.creating')}
              </>
            ) : (
              t('liveSession.create.submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
