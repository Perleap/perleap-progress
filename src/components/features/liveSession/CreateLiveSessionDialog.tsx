import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useLiveSessionProcessing } from '@/contexts/LiveSessionProcessingContext';
import { LIVE_SESSION_TYPES, type LiveSessionType } from '@/types/liveSession';
import {
  probeVideoFileForWarning,
  shouldShowLongRecordingWarning,
} from '@/lib/liveSessionExtractAudio';

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
  const { startJob, minimizeJob, activeJob, isRunning } = useLiveSessionProcessing();

  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState<LiveSessionType>('workshop');
  const [uploadMode, setUploadMode] = useState<'video' | 'audio'>('video');
  const [file, setFile] = useState<File | null>(null);
  const [longRecordingWarning, setLongRecordingWarning] = useState(false);
  const [videoProbeMeta, setVideoProbeMeta] = useState<{
    durationSeconds: number;
    fileSizeMb: number;
  } | null>(null);

  const isProcessingInDialog =
    open && isRunning && activeJob !== null && !activeJob.minimized;

  useEffect(() => {
    if (open && !isRunning) {
      setTitle('');
      setSessionType('workshop');
      setUploadMode('video');
      setFile(null);
      setLongRecordingWarning(false);
      setVideoProbeMeta(null);
    }
  }, [open, isRunning]);

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

  const handleDialogOpenChange = (next: boolean) => {
    if (!next && isRunning && activeJob && !activeJob.minimized) {
      minimizeJob();
    }
    onOpenChange(next);
  };

  const handleRunInBackground = () => {
    minimizeJob();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error(t('liveSession.create.titleRequired'));
      return;
    }
    if (!file) {
      toast.error(t('liveSession.create.fileRequired'));
      return;
    }

    const result = await startJob({
      classroomId,
      syllabusSectionId,
      title,
      sessionType,
      file,
      uploadMode,
      language: language === 'he' ? 'he' : 'en',
      knownDurationSeconds: videoProbeMeta?.durationSeconds,
      onAssignmentCreated,
    });

    if ('error' in result) {
      return;
    }

    if (result.minimized) {
      return;
    }

    toast.success(t('liveSession.create.success'));
    onCreated(result.assignmentId);
    onOpenChange(false);
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
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
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
              disabled={isProcessingInDialog}
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
                  disabled={isProcessingInDialog}
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
                disabled={isProcessingInDialog}
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
                disabled={isProcessingInDialog}
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
                isProcessingInDialog && 'pointer-events-none opacity-60'
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
              disabled={isProcessingInDialog}
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

        {isProcessingInDialog && activeJob ? (
          <LiveSessionCreateProgress
            percent={activeJob.percent}
            label={activeJob.progressLabel}
            transcriptionPhase={activeJob.transcriptionPhase}
          />
        ) : null}

        <DialogFooter className={cn(isRTL && 'sm:flex-row-reverse')}>
          {isProcessingInDialog ? (
            <Button variant="outline" onClick={handleRunInBackground}>
              {t('liveSession.create.runInBackground')}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
          )}
          <Button
            onClick={() => void handleSubmit()}
            disabled={isProcessingInDialog}
            className="gap-2"
          >
            {isProcessingInDialog ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {activeJob?.progressLabel ?? t('liveSession.create.creating')}
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
