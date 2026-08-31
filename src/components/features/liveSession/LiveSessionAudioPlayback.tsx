import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { getLiveSessionAudioBlobUrl } from '@/services/liveSessionService';

export type LiveSessionAudioPlaybackHandle = {
  seek: (seconds: number) => void;
};

type LiveSessionAudioPlaybackProps = {
  storagePaths: string[];
  durationSeconds: number | null;
};

/**
 * Plays a full recording (`playback.m4a`) or stitches Whisper chunks sequentially.
 */
export const LiveSessionAudioPlayback = forwardRef<
  LiveSessionAudioPlaybackHandle,
  LiveSessionAudioPlaybackProps
>(({ storagePaths, durationSeconds }, ref) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [chunkUrls, setChunkUrls] = useState<string[]>([]);
  const [activeChunk, setActiveChunk] = useState(0);
  const [chunkStarts, setChunkStarts] = useState<number[]>([0]);
  const [chunkDurations, setChunkDurations] = useState<number[]>([]);

  const isMultiChunk = storagePaths.length > 1;

  useEffect(() => {
    let cancelled = false;
    const revokes: (() => void)[] = [];
    void (async () => {
      const resolved = await Promise.all(
        storagePaths.map((path) => getLiveSessionAudioBlobUrl(path))
      );
      if (cancelled) {
        resolved.forEach((r) => r?.revoke());
        return;
      }
      const urls: string[] = [];
      for (const item of resolved) {
        if (item) {
          revokes.push(item.revoke);
          urls.push(item.url);
        }
      }
      setChunkUrls(urls);
      setActiveChunk(0);
    })();
    return () => {
      cancelled = true;
      revokes.forEach((revoke) => revoke());
    };
  }, [storagePaths]);

  useEffect(() => {
    if (!isMultiChunk || chunkUrls.length === 0) return;

    let cancelled = false;
    void (async () => {
      const durations: number[] = [];
      for (const url of chunkUrls) {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        const duration = await new Promise<number>((resolve) => {
          audio.onloadedmetadata = () =>
            resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
          audio.onerror = () => resolve(0);
          audio.src = url;
        });
        durations.push(duration);
      }
      if (!cancelled) {
        setChunkDurations(durations);
        const starts: number[] = [];
        let offset = 0;
        for (const d of durations) {
          starts.push(offset);
          offset += d;
        }
        setChunkStarts(starts);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chunkUrls, isMultiChunk]);

  const seek = useCallback(
    (seconds: number) => {
      if (!isMultiChunk) {
        const el = audioRef.current;
        if (!el) return;
        el.currentTime = seconds;
        void el.play().catch(() => {});
        return;
      }

      const totalDuration = chunkDurations.reduce((sum, d) => sum + d, 0) || durationSeconds || 0;
      const clamped = Math.max(0, Math.min(seconds, totalDuration));

      let targetChunk = 0;
      for (let i = chunkStarts.length - 1; i >= 0; i--) {
        if (clamped >= chunkStarts[i]) {
          targetChunk = i;
          break;
        }
      }

      setActiveChunk(targetChunk);
      requestAnimationFrame(() => {
        const el = audioRef.current;
        if (!el) return;
        el.currentTime = Math.max(0, clamped - chunkStarts[targetChunk]);
        void el.play().catch(() => {});
      });
    },
    [chunkDurations, chunkStarts, durationSeconds, isMultiChunk]
  );

  useImperativeHandle(ref, () => ({ seek }), [seek]);

  const handleEnded = () => {
    if (!isMultiChunk) return;
    if (activeChunk < chunkUrls.length - 1) {
      setActiveChunk((prev) => prev + 1);
    }
  };

  if (chunkUrls.length === 0) {
    return null;
  }

  return (
    <audio
      ref={audioRef}
      src={chunkUrls[activeChunk]}
      controls
      className="w-full"
      onEnded={handleEnded}
    />
  );
});
