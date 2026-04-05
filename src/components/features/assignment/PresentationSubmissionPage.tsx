import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Upload, Video, Square, Circle, RotateCcw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { completeSubmission } from '@/services/submissionService';
import { useQueryClient } from '@tanstack/react-query';
import { assignmentKeys } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { DeviceSelector, NO_AUDIO, type DeviceSelection } from './DeviceSelector';
import { VideoEditor } from './VideoEditor';

/** Immediate revoke can race Chromium range requests on <video src="blob:…"> → net::ERR_REQUEST_RANGE_NOT_SATISFIABLE */
function scheduleRevokeObjectURL(url: string, delayMs = 750) {
  window.setTimeout(() => URL.revokeObjectURL(url), delayMs);
}

interface PresentationSubmissionPageProps {
  assignmentId: string;
  submissionId: string;
  onComplete: () => void;
}

type RecordPhase = 'idle' | 'recording' | 'editing' | 'ready';

export function PresentationSubmissionPage({
  assignmentId,
  submissionId,
  onComplete,
}: PresentationSubmissionPageProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const prevModeRef = useRef<'upload' | 'record'>('upload');
  const activePresentationBlobUrlRef = useRef<string | null>(null);

  const releaseMediaDevices = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    const el = videoPreviewRef.current;
    if (el) {
      el.srcObject = null;
      el.removeAttribute('src');
    }
  }, []);

  const [mode, setMode] = useState<'upload' | 'record'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordPhase, setRecordPhase] = useState<RecordPhase>('idle');
  const [deviceSelection, setDeviceSelection] = useState<DeviceSelection>({
    videoDeviceId: '',
    audioDeviceId: NO_AUDIO,
  });
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  /** Paired blob+URL so we never render a stale object URL after `recordedBlob` changes (revoking while <video> still points at it causes net::ERR_REQUEST_RANGE_NOT_SATISFIABLE). */
  const [blobUrlPair, setBlobUrlPair] = useState<{ blob: Blob; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useLayoutEffect(() => {
    if (!recordedBlob) {
      setBlobUrlPair((prev) => {
        if (prev) scheduleRevokeObjectURL(prev.url);
        return null;
      });
      activePresentationBlobUrlRef.current = null;
      return;
    }
    const nextUrl = URL.createObjectURL(recordedBlob);
    setBlobUrlPair((prev) => {
      if (prev) scheduleRevokeObjectURL(prev.url);
      return { blob: recordedBlob, url: nextUrl };
    });
    activePresentationBlobUrlRef.current = nextUrl;
  }, [recordedBlob]);

  useEffect(() => {
    return () => {
      const u = activePresentationBlobUrlRef.current;
      if (u) {
        URL.revokeObjectURL(u);
        activePresentationBlobUrlRef.current = null;
      }
    };
  }, []);

  const urlForCurrentBlob =
    blobUrlPair && blobUrlPair.blob === recordedBlob ? blobUrlPair.url : null;

  useEffect(() => {
    return () => {
      releaseMediaDevices();
    };
  }, [releaseMediaDevices]);

  useEffect(() => {
    if (prevModeRef.current === 'record' && mode === 'upload') {
      if (recording || streamRef.current) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try {
            mediaRecorderRef.current.stop();
          } catch {
            /* ignore */
          }
        }
        releaseMediaDevices();
        setRecording(false);
        setRecordPhase('idle');
      }
    }
    prevModeRef.current = mode;
  }, [mode, recording, releaseMediaDevices]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setUploadedUrl(null);
    }
  }, []);

  const pickRecorderMimeType = useCallback(() => {
    if (typeof MediaRecorder === 'undefined') return '';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) return 'video/webm;codecs=vp9,opus';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) return 'video/webm;codecs=vp8,opus';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return 'video/webm;codecs=vp9';
    if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm';
    return '';
  }, []);

  const startRecording = async () => {
    if (!deviceSelection.videoDeviceId) {
      toast.error(t('assignmentDetail.presentation.selectCamera'));
      return;
    }

    releaseMediaDevices();

    const vid = { deviceId: { exact: deviceSelection.videoDeviceId } };
    const wantAudio = deviceSelection.audioDeviceId !== NO_AUDIO;
    const defaultMicProcessing = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    } as const;

    const attempts: MediaStreamConstraints[] = [];

    if (!wantAudio) {
      attempts.push(
        { video: vid, audio: false },
        { video: true, audio: false },
        { video: { facingMode: 'user' }, audio: false }
      );
    } else {
      const micId = deviceSelection.audioDeviceId;
      attempts.push({
        video: vid,
        audio: { deviceId: { exact: micId }, ...defaultMicProcessing },
      });
      attempts.push({
        video: vid,
        audio: { deviceId: { ideal: micId }, ...defaultMicProcessing },
      });
      attempts.push({ video: vid, audio: true });
      attempts.push({ video: true, audio: true });
    }

    let stream: MediaStream | null = null;
    let usedAudio = false;
    let lastError: unknown;

    for (const constraints of attempts) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        const hasAudio = s.getAudioTracks().length > 0;
        /** Do not accept video-only when a mic was chosen — the old `{ video: vid, audio: false }` fallback often "won" and dropped audio. */
        if (wantAudio && !hasAudio) {
          s.getTracks().forEach((t) => t.stop());
          continue;
        }
        stream = s;
        usedAudio = hasAudio;
        break;
      } catch (e) {
        lastError = e;
      }
    }

    if (!stream && wantAudio) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: vid, audio: false });
        usedAudio = false;
      } catch (e) {
        lastError = e;
      }
    }

    if (!stream) {
      const err = lastError instanceof DOMException ? lastError : new DOMException(String(lastError));
      console.error('Camera access error:', lastError);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error(t('assignmentDetail.presentation.cameraPermission'));
      } else {
        toast.error(t('assignmentDetail.presentation.cameraNotReadable'));
      }
      return;
    }

    if (!usedAudio) {
      toast.message(t('assignmentDetail.presentation.recordingVideoOnly'));
    }

    try {
      streamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.muted = true;
        await videoPreviewRef.current.play().catch(() => {});
      }

      const mimeType = pickRecorderMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      const outType = mediaRecorder.mimeType || 'video/webm';

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: outType });
        setRecordedBlob(blob);

        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
          videoPreviewRef.current.removeAttribute('src');
        }
        setRecordPhase('editing');
      };

      mediaRecorder.start(1000);
      setRecording(true);
      setRecordedBlob(null);
      setUploadedUrl(null);
    } catch (error) {
      releaseMediaDevices();
      console.error('Recording setup error:', error);
      toast.error(t('assignmentDetail.presentation.cameraNotReadable'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const recordAgain = () => {
    releaseMediaDevices();
    setRecordPhase('idle');
    setRecordedBlob(null);
    setUploadedUrl(null);
  };

  const onEditorSave = (blob: Blob) => {
    setRecordedBlob(blob);
    setRecordPhase('ready');
  };

  const onEditorDiscard = () => {
    recordAgain();
  };

  const uploadVideo = async (file: File | Blob, extension: string) => {
    setUploading(true);
    try {
      const filePath = `${assignmentId}/${submissionId}/presentation.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('submission-files')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('submission-files')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      await supabase
        .from('submissions')
        .update({ file_url: publicUrl })
        .eq('id', submissionId);

      setUploadedUrl(publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(t('assignmentDetail.presentation.uploadError'));
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let url = uploadedUrl;

      if (!url) {
        if (mode === 'upload' && selectedFile) {
          const ext = selectedFile.name.split('.').pop() || 'mp4';
          url = await uploadVideo(selectedFile, ext);
        } else if (mode === 'record' && recordedBlob) {
          url = await uploadVideo(recordedBlob, 'webm');
        }
      }

      if (!url) {
        setSubmitting(false);
        return;
      }

      const { error } = await completeSubmission(submissionId);
      if (error) throw error;

      toast.success(t('assignmentDetail.presentation.awaitingReview'));
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
      onComplete();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const hasContent =
    (mode === 'upload' && selectedFile) ||
    (mode === 'record' && recordPhase === 'ready' && recordedBlob);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('assignmentDetail.presentation.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'upload' | 'record')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              {t('assignmentDetail.presentation.uploadTab')}
            </TabsTrigger>
            <TabsTrigger value="record" className="gap-2">
              <Video className="h-4 w-4" />
              {t('assignmentDetail.presentation.recordTab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            {!selectedFile ? (
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
              >
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium">{t('assignmentDetail.presentation.dragDrop')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('assignmentDetail.presentation.fileTypes')}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      setUploadedUrl(null);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <Video className="h-8 w-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setUploadedUrl(null);
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="record" className="space-y-4">
            {recordPhase === 'editing' && urlForCurrentBlob && (
              <VideoEditor videoUrl={urlForCurrentBlob} onSave={onEditorSave} onDiscard={onEditorDiscard} />
            )}

            {recordPhase !== 'editing' && (
              <>
                {recordPhase === 'idle' && !recording && (
                  <DeviceSelector value={deviceSelection} onChange={setDeviceSelection} />
                )}

                {recordPhase === 'ready' && urlForCurrentBlob && (
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">{t('assignmentDetail.presentation.reviewHeading')}</h3>
                    <p className="text-xs text-muted-foreground">{t('assignmentDetail.presentation.reviewHelper')}</p>
                  </div>
                )}

                <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                  <video
                    key={urlForCurrentBlob ?? `phase-${recordPhase}`}
                    ref={videoPreviewRef}
                    className={cn(
                      'absolute inset-0 h-full w-full',
                      recordPhase === 'ready' && urlForCurrentBlob ? 'object-cover' : 'object-contain'
                    )}
                    playsInline
                    controls={recordPhase === 'ready' && !!urlForCurrentBlob && !recording}
                    src={recordPhase === 'ready' && urlForCurrentBlob ? urlForCurrentBlob : undefined}
                  />
                  {recordPhase === 'idle' && !recording && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-white/60 text-sm text-center px-4">
                        {t('assignmentDetail.presentation.cameraPermission')}
                      </p>
                    </div>
                  )}
                  {recording && (
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">
                        {t('assignmentDetail.presentation.recording')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {recordPhase === 'idle' && !recording && (
                    <Button
                      onClick={startRecording}
                      disabled={!deviceSelection.videoDeviceId}
                      className="gap-2"
                    >
                      <Circle className="h-4 w-4 fill-current" />
                      {t('assignmentDetail.presentation.startRecording')}
                    </Button>
                  )}
                  {recording && (
                    <Button onClick={stopRecording} variant="destructive" className="gap-2">
                      <Square className="h-4 w-4 fill-current" />
                      {t('assignmentDetail.presentation.stopRecording')}
                    </Button>
                  )}
                  {recordPhase === 'ready' && !recording && (
                    <Button onClick={recordAgain} variant="outline" className="gap-2">
                      <RotateCcw className="h-4 w-4" />
                      {t('assignmentDetail.presentation.recordAgain')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {hasContent && (
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSubmit}
              disabled={submitting || uploading}
              size="lg"
              className="gap-2 rounded-full shadow-md"
            >
              {submitting || uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('assignmentDetail.presentation.submitting')}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t('assignmentDetail.presentation.submit')}
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
