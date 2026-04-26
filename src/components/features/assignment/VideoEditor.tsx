import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Scissors,
  Crop,
  Gauge,
  Type,
  Play,
  Pause,
  Check,
  X,
  Film,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CropOverlay, DEFAULT_CROP, type CropPercent, type CropPreset } from './CropOverlay';
import { cn } from '@/lib/utils';

export interface TextOverlayItem {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

const TEXT_COLORS = ['#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#f97316'];
const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];
/** Minimum gap between trim in/out (seconds); ~1 frame at 30fps */
const TRIM_MIN_GAP = 1 / 30;

/** Blob / MediaRecorder WebM often reports NaN until durationchange; seekable.end may work earlier. */
function readPlaybackDuration(v: HTMLVideoElement): number {
  const d = v.duration;
  if (Number.isFinite(d) && d > 0 && d !== Number.POSITIVE_INFINITY) return d;
  try {
    if (v.seekable?.length) {
      const end = v.seekable.end(v.seekable.length - 1);
      if (Number.isFinite(end) && end > 0) return end;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

function pickExportMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return 'video/webm;codecs=vp9';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) return 'video/webm;codecs=vp8';
  return 'video/webm';
}

/** Prefer VP9+Opus when the stream has audio so MediaRecorder muxes both tracks. */
function pickRecorderMimeTypeForStream(stream: MediaStream): string {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  const hasAudio = stream.getAudioTracks().length > 0;
  if (hasAudio) {
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) return 'video/webm;codecs=vp9,opus';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) return 'video/webm;codecs=vp8,opus';
  }
  return pickExportMimeType();
}

async function exportEditedVideo(
  videoUrl: string,
  trimStart: number,
  trimEnd: number,
  crop: CropPercent,
  speed: number,
  textOverlays: TextOverlayItem[],
  onProgress: (p: number) => void
): Promise<Blob> {
  const video = document.createElement('video');
  video.src = videoUrl;
  /** Must stay unmuted so `captureStream()` includes audio; keep speaker silent during export. */
  video.muted = false;
  video.volume = 0;
  video.playbackRate = speed;
  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error('video load'));
  });

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const sx = (crop.x / 100) * vw;
  const sy = (crop.y / 100) * vh;
  const sw = (crop.width / 100) * vw;
  const sh = (crop.height / 100) * vh;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.floor(sw));
  canvas.height = Math.max(2, Math.floor(sh));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas context');

  const drawOverlays = () => {
    for (const o of textOverlays) {
      if (!o.text.trim()) continue;
      ctx.font = `${o.fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = o.color;
      ctx.textBaseline = 'top';
      ctx.fillText(o.text, (o.x / 100) * canvas.width, (o.y / 100) * canvas.height);
    }
  };

  const canvasStream = canvas.captureStream(30);
  const canvasVideoTracks = canvasStream.getVideoTracks();

  const wallDuration = Math.max(0.05, (trimEnd - trimStart) / speed);
  const chunks: Blob[] = [];

  await new Promise<void>((resolve, reject) => {
    let recorder: MediaRecorder;

    const finish = () => {
      video.pause();
      recorder.stop();
    };

    let playbackStarted = false;
    const afterSeek = () => {
      if (playbackStarted) return;
      playbackStarted = true;

      const runStepLoop = () => {
        const t0 = performance.now();
        const step = () => {
          if (video.currentTime >= trimEnd - 0.06 || video.ended) {
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
            drawOverlays();
            onProgress(1);
            finish();
            return;
          }
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          drawOverlays();
          const elapsed = (performance.now() - t0) / 1000;
          onProgress(Math.min(1, elapsed / wallDuration));
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };

      /** Audio tracks often appear only after playback has started (see HTMLMediaElement.captureStream). */
      const startRecordingPipeline = () => {
        let outputStream: MediaStream;
        const mediaEl = video as HTMLVideoElement & {
          captureStream?: (frameRate?: number) => MediaStream;
        };
        if (typeof mediaEl.captureStream === 'function') {
          const fromEl = mediaEl.captureStream();
          const audioTracks = fromEl.getAudioTracks();
          outputStream =
            audioTracks.length > 0
              ? new MediaStream([...canvasVideoTracks, ...audioTracks])
              : new MediaStream([...canvasVideoTracks]);
        } else {
          outputStream = new MediaStream([...canvasVideoTracks]);
        }
        const mimeType = pickRecorderMimeTypeForStream(outputStream);
        recorder = new MediaRecorder(outputStream, { mimeType });
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorder.onstop = () => resolve();
        recorder.start(250);
        runStepLoop();
      };

      const tryPlay = () => {
        const p = video.play();
        if (p === undefined) {
          startRecordingPipeline();
          return;
        }
        p.then(startRecordingPipeline, (err: unknown) => {
          const e = err as { name?: string };
          if (e?.name === 'AbortError') {
            const p2 = video.play();
            if (p2 === undefined) startRecordingPipeline();
            else p2.then(startRecordingPipeline, reject);
          } else {
            reject(err);
          }
        });
      };
      tryPlay();
    };

    video.addEventListener('seeked', afterSeek, { once: true });
    video.currentTime = trimStart;
    window.setTimeout(() => {
      if (!playbackStarted) afterSeek();
    }, 300);
  });

  const blobType = chunks[0]?.type || 'video/webm';
  return new Blob(chunks, { type: blobType.split(';')[0] || 'video/webm' });
}

interface VideoEditorProps {
  videoUrl: string;
  onSave: (blob: Blob) => void;
  onDiscard: () => void;
}

export function VideoEditor({ videoUrl, onSave, onDiscard }: VideoEditorProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewLoopRef = useRef<number>(0);

  const [duration, setDuration] = useState(0);
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 0]);
  const [playhead, setPlayhead] = useState(0);
  const [crop, setCrop] = useState<CropPercent>(DEFAULT_CROP);
  const [cropPreset, setCropPreset] = useState<CropPreset>('free');
  const [speed, setSpeed] = useState(1);
  const [textOverlays, setTextOverlays] = useState<TextOverlayItem[]>([]);
  const [activeTool, setActiveTool] = useState<'trim' | 'crop' | 'speed' | 'text' | 'none'>('trim');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [previewExportOpen, setPreviewExportOpen] = useState(false);
  const [previewExportUrl, setPreviewExportUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const previewUrlRef = useRef<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineDragRef = useRef<'seek' | 'trimIn' | 'trimOut' | null>(null);
  const timelineDragCleanupRef = useRef<(() => void) | null>(null);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const textDragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });

  const syncDurationFromVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const d = readPlaybackDuration(v);
    if (!(d > 0)) return;
    setDuration(d);
    setTrimRange((prev) => {
      const collapsed = prev[1] <= 0 || (prev[0] === 0 && prev[1] === 0);
      if (collapsed) return [0, d];
      return [Math.min(prev[0], d), Math.min(prev[1], d)];
    });
  }, []);

  const onVideoMeta = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    syncDurationFromVideo();
    setPlayhead(0);
  }, [syncDurationFromVideo]);

  useEffect(() => {
    setDuration(0);
    setTrimRange([0, 0]);
    setPlayhead(0);
  }, [videoUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setPlayhead(v.currentTime);
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, []);

  /** Smooth playhead while playing (timeupdate is too coarse for the line). */
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    let raf = 0;
    const tick = () => {
      if (cancelled) return;
      const v = videoRef.current;
      if (v) setPlayhead(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [playing]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoUrl) return;
    const onDur = () => syncDurationFromVideo();
    const onData = () => syncDurationFromVideo();
    v.addEventListener('durationchange', onDur);
    v.addEventListener('loadeddata', onData);
    syncDurationFromVideo();
    return () => {
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('loadeddata', onData);
    };
  }, [videoUrl, syncDurationFromVideo]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const syncPlaying = () => setPlaying(!v.paused);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    syncPlaying();
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      timelineDragCleanupRef.current?.();
      timelineDragCleanupRef.current = null;
    };
  }, []);

  const runPreviewTrim = () => {
    const v = videoRef.current;
    if (!v) return;
    const [start, end] = trimRange;
    if (end - start < 0.05) return;
    cancelAnimationFrame(previewLoopRef.current);
    v.pause();
    v.currentTime = start;
    v.playbackRate = speed;
    const playP = v.play();
    if (playP !== undefined) {
      void playP.catch((err: unknown) => {
        const e = err as { name?: string };
        if (e?.name !== 'AbortError') console.warn('Preview play failed', err);
      });
    }
    const stopAt = end;
    const tick = () => {
      const el = videoRef.current;
      if (!el) return;
      if (el.currentTime >= stopAt - 0.05 || el.ended) {
        el.pause();
        el.currentTime = start;
        return;
      }
      previewLoopRef.current = requestAnimationFrame(tick);
    };
    previewLoopRef.current = requestAnimationFrame(tick);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch((err: unknown) => {
        const e = err as { name?: string };
        if (e?.name !== 'AbortError') console.warn('Play failed', err);
      });
    } else {
      v.pause();
    }
  };

  const doneTrim = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      toast.success(t('assignmentDetail.presentation.editor.trimConfirmed'));
      setActiveTool('none');
    },
    [t]
  );

  const doneCrop = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      toast.success(t('assignmentDetail.presentation.editor.cropConfirmed'));
      setActiveTool('none');
    },
    [t]
  );

  const handlePreviewExport = async () => {
    if (previewBusy || exporting) return;
    setPreviewBusy(true);
    setPreviewProgress(0);
    try {
      const blob = await exportEditedVideo(
        videoUrl,
        trimRange[0],
        trimRange[1],
        crop,
        speed,
        textOverlays,
        setPreviewProgress
      );
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewExportUrl(url);
      setPreviewExportOpen(true);
    } catch (e) {
      console.error(e);
      toast.error(t('assignmentDetail.presentation.editor.previewExportFailed'));
    } finally {
      setPreviewBusy(false);
    }
  };

  const onPreviewExportDialogChange = (open: boolean) => {
    if (!open) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewExportUrl(null);
    }
    setPreviewExportOpen(open);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);
    try {
      const blob = await exportEditedVideo(
        videoUrl,
        trimRange[0],
        trimRange[1],
        crop,
        speed,
        textOverlays,
        setExportProgress
      );
      onSave(blob);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const addTextOverlay = () => {
    setTextOverlays((prev) => [
      ...prev,
      {
        id: `t_${Date.now()}`,
        text: '',
        x: 10,
        y: 10,
        fontSize: 24,
        color: TEXT_COLORS[0],
      },
    ]);
    setActiveTool('text');
  };

  const onTextMouseDown = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const item = textOverlays.find((x) => x.id === id);
    if (!item) return;
    textDragRef.current = { startX: e.clientX, startY: e.clientY, origX: item.x, origY: item.y };
    setDraggingTextId(id);
  };

  useEffect(() => {
    if (!draggingTextId) return;
    const wrap = videoRef.current?.parentElement;
    if (!wrap) return;

    const onMove = (ev: Event) => {
      const e = ev as globalThis.MouseEvent;
      const rect = wrap.getBoundingClientRect();
      const dx = ((e.clientX - textDragRef.current.startX) / rect.width) * 100;
      const dy = ((e.clientY - textDragRef.current.startY) / rect.height) * 100;
      setTextOverlays((prev) =>
        prev.map((o) =>
          o.id === draggingTextId
            ? {
                ...o,
                x: Math.max(0, Math.min(92, textDragRef.current.origX + dx)),
                y: Math.max(0, Math.min(92, textDragRef.current.origY + dy)),
              }
            : o
        )
      );
    };
    const onUp = () => setDraggingTextId(null);
    window.addEventListener('mousemove', onMove as EventListener);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove as EventListener);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingTextId]);

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const showTrimChrome = activeTool === 'trim' || activeTool === 'crop';

  const getTimeFromClientX = useCallback(
    (clientX: number) => {
      const el = timelineRef.current;
      if (!el || duration <= 0) return 0;
      const rect = el.getBoundingClientRect();
      const w = Math.max(rect.width, 1);
      return Math.min(duration, Math.max(0, ((clientX - rect.left) / w) * duration));
    },
    [duration]
  );

  const skipBy = useCallback(
    (deltaSec: number) => {
      const v = videoRef.current;
      if (!v || duration <= 0) return;
      v.currentTime = Math.min(duration, Math.max(0, v.currentTime + deltaSec));
      setPlayhead(v.currentTime);
    },
    [duration]
  );

  const skipFrame = useCallback(
    (direction: 1 | -1) => {
      const v = videoRef.current;
      if (!v || duration <= 0) return;
      v.currentTime = Math.min(duration, Math.max(0, v.currentTime + direction * TRIM_MIN_GAP));
      setPlayhead(v.currentTime);
    },
    [duration]
  );

  const TRIM_HANDLE_PX = 22;

  const applyTimelineClientX = useCallback(
    (clientX: number) => {
      const t = getTimeFromClientX(clientX);
      const mode = timelineDragRef.current;
      if (mode === 'seek') {
        const v = videoRef.current;
        if (v) {
          v.currentTime = t;
          setPlayhead(t);
        }
      } else if (mode === 'trimIn') {
        setTrimRange(([start, end]) => {
          const ns = Math.min(t, end - TRIM_MIN_GAP);
          return [Math.max(0, ns), end];
        });
      } else if (mode === 'trimOut') {
        setTrimRange(([start, end]) => {
          const ne = Math.max(t, start + TRIM_MIN_GAP);
          return [start, Math.min(duration, ne)];
        });
      }
    },
    [duration, getTimeFromClientX]
  );

  const onTimelinePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (duration <= 0 || exporting || previewBusy) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      timelineDragCleanupRef.current?.();
      timelineDragCleanupRef.current = null;

      const el = timelineRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const w = Math.max(rect.width, 1);
      const t = (px / w) * duration;

      if (showTrimChrome) {
        const tsPx = (trimRange[0] / duration) * w;
        const tePx = (trimRange[1] / duration) * w;
        if (Math.abs(px - tsPx) <= TRIM_HANDLE_PX) {
          timelineDragRef.current = 'trimIn';
        } else if (Math.abs(px - tePx) <= TRIM_HANDLE_PX) {
          timelineDragRef.current = 'trimOut';
        } else {
          timelineDragRef.current = 'seek';
          const v = videoRef.current;
          if (v) {
            v.currentTime = t;
            setPlayhead(t);
          }
        }
      } else {
        timelineDragRef.current = 'seek';
        const v = videoRef.current;
        if (v) {
          v.currentTime = t;
          setPlayhead(t);
        }
      }

      const pid = e.pointerId;
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== pid) return;
        ev.preventDefault();
        applyTimelineClientX(ev.clientX);
      };
      const cleanup = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', end);
        document.removeEventListener('pointercancel', end);
        timelineDragRef.current = null;
        timelineDragCleanupRef.current = null;
        try {
          (el as HTMLElement).releasePointerCapture(pid);
        } catch {
          /* ignore */
        }
      };
      const end = (ev: PointerEvent) => {
        if (ev.pointerId !== pid) return;
        cleanup();
      };

      document.addEventListener('pointermove', move, { passive: false });
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', end);
      timelineDragCleanupRef.current = cleanup;

      try {
        (e.currentTarget as HTMLElement).setPointerCapture(pid);
      } catch {
        /* document listeners still run */
      }
    },
    [applyTimelineClientX, duration, exporting, previewBusy, showTrimChrome, trimRange]
  );

  return (
    <div className="space-y-4">
      {activeTool === 'crop' && (
        <div className="flex flex-wrap gap-1.5">
          {(['free', '16_9', '4_3', '1_1'] as const).map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={cropPreset === p ? 'default' : 'outline'}
              onClick={() => {
                setCropPreset(p);
                if (p === 'free') {
                  setCrop(DEFAULT_CROP);
                } else {
                  const ratio = p === '16_9' ? 16 / 9 : p === '4_3' ? 4 / 3 : 1;
                  let width = 88;
                  let height = width / ratio;
                  if (height > 88) {
                    height = 88;
                    width = height * ratio;
                  }
                  const x = (100 - width) / 2;
                  const y = (100 - height) / 2;
                  setCrop({ x, y, width, height });
                }
              }}
            >
              {t(`assignmentDetail.presentation.editor.cropPresets.${p}`)}
            </Button>
          ))}
        </div>
      )}

      <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          className={cn('absolute inset-0 w-full h-full object-contain', activeTool === 'crop' && 'pointer-events-none')}
          playsInline
          onLoadedMetadata={onVideoMeta}
        />
        {activeTool === 'crop' && (
          <div className="absolute inset-0 z-10 pointer-events-auto">
            <CropOverlay
              crop={crop}
              onCropChange={setCrop}
              preset={cropPreset}
              onPresetChange={setCropPreset}
              overlayMode
              showPresetButtons={false}
            />
          </div>
        )}
        {activeTool === 'text' &&
          textOverlays.map((o) => (
            <div
              key={o.id}
              className="absolute z-20 cursor-move select-none px-1 rounded"
              style={{
                left: `${o.x}%`,
                top: `${o.y}%`,
                fontSize: o.fontSize,
                color: o.color,
                textShadow: '0 0 4px #000',
              }}
              onMouseDown={(e) => onTextMouseDown(o.id, e)}
            >
              {o.text || '…'}
            </div>
          ))}
      </div>

      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={togglePlay}
          disabled={exporting || previewBusy}
          aria-label={playing ? t('assignmentDetail.presentation.editor.pause') : t('assignmentDetail.presentation.editor.play')}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? t('assignmentDetail.presentation.editor.pause') : t('assignmentDetail.presentation.editor.play')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={runPreviewTrim}
          disabled={exporting || previewBusy}
        >
          <Play className="h-4 w-4" />
          {t('assignmentDetail.presentation.editor.previewSelection')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => void handlePreviewExport()}
          disabled={exporting || previewBusy}
        >
          {previewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
          {previewBusy
            ? `${Math.round(previewProgress * 100)}%`
            : t('assignmentDetail.presentation.editor.previewExport')}
        </Button>
        {activeTool === 'trim' && (
          <Button type="button" size="sm" variant="default" onClick={doneTrim}>
            {t('assignmentDetail.presentation.editor.doneTrim')}
          </Button>
        )}
        {activeTool === 'crop' && (
          <Button type="button" size="sm" variant="default" onClick={doneCrop}>
            {t('assignmentDetail.presentation.editor.doneCrop')}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className={cn(showTrimChrome && 'font-medium text-foreground')}>{fmt(trimRange[0])}</span>
          <span
            className={cn(
              'tabular-nums',
              showTrimChrome && 'border-b-2 border-foreground pb-0.5 font-medium text-foreground'
            )}
          >
            {fmt(playhead)} / {fmt(duration)}
          </span>
          <span className={cn(showTrimChrome && 'font-medium text-foreground')}>{fmt(trimRange[1])}</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-9 shrink-0"
            disabled={duration <= 0 || exporting || previewBusy}
            aria-label={t('assignmentDetail.presentation.editor.seekBack5s')}
            onClick={() => skipBy(-5)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-9 shrink-0"
            disabled={duration <= 0 || exporting || previewBusy}
            aria-label={t('assignmentDetail.presentation.editor.frameBack')}
            onClick={() => skipFrame(-1)}
          >
            <span className="font-mono text-xs leading-none">−1</span>
          </Button>
          <div
            ref={timelineRef}
            className={cn(
              'relative h-10 min-h-10 min-w-0 flex-1 touch-none overflow-hidden rounded-full border border-border bg-muted select-none',
              showTrimChrome ? 'cursor-col-resize' : 'cursor-pointer'
            )}
            onPointerDown={onTimelinePointerDown}
            role="slider"
            aria-label={t('assignmentDetail.presentation.editor.timelineAria')}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration * 100) / 100}
            aria-valuenow={Math.round(playhead * 100) / 100}
          >
            {duration > 0 && (
              <>
                {showTrimChrome && (
                  <div
                    className="pointer-events-none absolute inset-y-0 bg-foreground/25 dark:bg-foreground/35"
                    style={{
                      left: `${(trimRange[0] / duration) * 100}%`,
                      width: `${((trimRange[1] - trimRange[0]) / duration) * 100}%`,
                    }}
                  />
                )}
                {showTrimChrome && (
                  <>
                    <div
                      className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-foreground"
                      style={{ left: `${(trimRange[0] / duration) * 100}%`, transform: 'translateX(-50%)' }}
                    />
                    <div
                      className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-foreground"
                      style={{ left: `${(trimRange[1] / duration) * 100}%`, transform: 'translateX(-50%)' }}
                    />
                  </>
                )}
                <div
                  className="pointer-events-none absolute inset-y-0 z-[2] w-px bg-foreground shadow-sm"
                  style={{
                    left: `${(playhead / duration) * 100}%`,
                    transform: 'translateX(-50%)',
                  }}
                />
              </>
            )}
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-9 shrink-0"
            disabled={duration <= 0 || exporting || previewBusy}
            aria-label={t('assignmentDetail.presentation.editor.frameForward')}
            onClick={() => skipFrame(1)}
          >
            <span className="font-mono text-xs leading-none">+1</span>
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-9 shrink-0"
            disabled={duration <= 0 || exporting || previewBusy}
            aria-label={t('assignmentDetail.presentation.editor.seekForward5s')}
            onClick={() => skipBy(5)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {showTrimChrome && (
          <p className="text-[11px] text-muted-foreground">
            {t('assignmentDetail.presentation.editor.timelineTrimHint')}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['trim', Scissors],
            ['crop', Crop],
            ['speed', Gauge],
            ['text', Type],
          ] as const
        ).map(([key, Icon]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={activeTool === key ? 'default' : 'outline'}
            onClick={() => setActiveTool(key)}
            className="gap-1.5"
          >
            <Icon className="h-3.5 w-3.5" />
            {t(`assignmentDetail.presentation.editor.${key}`)}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={activeTool === 'none' ? 'secondary' : 'outline'}
          onClick={() => setActiveTool('none')}
          className="gap-1.5"
        >
          {t('assignmentDetail.presentation.editor.none')}
        </Button>
      </div>

      {activeTool === 'speed' && (
        <div className="flex flex-wrap gap-1.5">
          {SPEED_PRESETS.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={speed === s ? 'default' : 'secondary'}
              onClick={() => {
                setSpeed(s);
                if (videoRef.current) videoRef.current.playbackRate = s;
              }}
            >
              {s}x
            </Button>
          ))}
        </div>
      )}

      {activeTool === 'text' && (
        <div className="space-y-3 rounded-lg border p-3">
          <Button type="button" size="sm" variant="secondary" onClick={addTextOverlay}>
            {t('assignmentDetail.presentation.editor.addText')}
          </Button>
          {textOverlays.map((o) => (
            <div key={o.id} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">{t('assignmentDetail.presentation.editor.textLabel')}</Label>
                <Input
                  value={o.text}
                  onChange={(e) =>
                    setTextOverlays((prev) => prev.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))
                  }
                />
              </div>
              <div className="w-full sm:w-36 space-y-1">
                <Label className="text-xs">{t('assignmentDetail.presentation.editor.fontSize')}</Label>
                <Slider
                  value={[o.fontSize]}
                  min={12}
                  max={48}
                  step={1}
                  onValueChange={(v) => {
                    const n = Array.isArray(v) ? v[0] : v;
                    setTextOverlays((prev) =>
                      prev.map((x) => (x.id === o.id ? { ...x, fontSize: n } : x))
                    );
                  }}
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn('h-7 w-7 rounded-full border-2', o.color === c && 'ring-2 ring-primary')}
                    style={{ backgroundColor: c }}
                    onClick={() =>
                      setTextOverlays((prev) => prev.map((x) => (x.id === o.id ? { ...x, color: c } : x)))
                    }
                  />
                ))}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setTextOverlays((p) => p.filter((x) => x.id !== o.id))}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onDiscard} disabled={exporting || previewBusy}>
          {t('assignmentDetail.presentation.editor.discard')}
        </Button>
        <Button type="button" onClick={() => void handleExport()} disabled={exporting || previewBusy}>
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              {t('assignmentDetail.presentation.editor.exporting')} {Math.round(exportProgress * 100)}%
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-1" />
              {t('assignmentDetail.presentation.editor.apply')}
            </>
          )}
        </Button>
      </div>

      <Dialog open={previewExportOpen} onOpenChange={onPreviewExportDialogChange}>
        <DialogContent className="sm:max-w-2xl" dir="auto">
          <DialogHeader>
            <DialogTitle>{t('assignmentDetail.presentation.editor.previewExport')}</DialogTitle>
            <DialogDescription>{t('assignmentDetail.presentation.editor.previewExportDescription')}</DialogDescription>
          </DialogHeader>
          {previewExportUrl ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
              <video
                src={previewExportUrl}
                controls
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
