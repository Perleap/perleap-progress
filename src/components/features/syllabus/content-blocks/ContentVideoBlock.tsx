import { useEffect, useId, useMemo, useRef, type IframeHTMLAttributes } from 'react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { cn } from '@/lib/utils';
import { loadYoutubeIframeApi } from '@/lib/youtubeIframeApi';
import { parseYoutubeUrl, youtubeEmbedUrl } from '@/lib/youtube';
import { useVideoWatchTracking } from '@/hooks/useVideoWatchTracking';
import type { VideoWatchTrackingContext } from '@/types/videoWatch';
import type { LessonVideoSource } from '@/types/syllabus';
import { ContentBlockShell } from './ContentBlockShell';
import { lessonActivityColumnClass } from './readingLayout';

export type ContentVideoPresentation = 'reading' | 'embedded' | 'compact';

export function ContentVideoBlock({
  videoUrl,
  source,
  presentation,
  className,
  tracking,
}: {
  videoUrl: string;
  source?: LessonVideoSource;
  presentation: ContentVideoPresentation;
  className?: string;
  tracking?: VideoWatchTrackingContext;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeContainerRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const youtubeContainerId = useMemo(
    () => `yt-${tracking?.resourceId ?? 'video'}-${tracking?.lessonBlockId ?? 'main'}-${reactId.replace(/:/g, '')}`,
    [reactId, tracking?.lessonBlockId, tracking?.resourceId],
  );

  const parsedYoutube =
    source === 'youtube' || (source !== 'upload' && parseYoutubeUrl(videoUrl))
      ? parseYoutubeUrl(videoUrl)
      : null;

  const {
    handlePlay,
    handlePause,
    handleTimeUpdate,
    handleSeeked,
    handleEnded,
    handleLoadedMetadata,
    flush,
  } = useVideoWatchTracking(tracking);

  useEffect(() => {
    if (!parsedYoutube || !tracking || !youtubeContainerRef.current) return;

    let player: YT.Player | null = null;
    let pollId: number | null = null;
    let cancelled = false;

    void loadYoutubeIframeApi().then(() => {
      if (cancelled || !youtubeContainerRef.current || !window.YT?.Player) return;

      player = new window.YT.Player(youtubeContainerId, {
        height: '100%',
        width: '100%',
        videoId: parsedYoutube.videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING) {
              handlePlay();
              const current = player?.getCurrentTime() ?? 0;
              const duration = player?.getDuration() ?? 0;
              handleTimeUpdate(current, duration);
            } else if (event.data === YT.PlayerState.PAUSED) {
              const current = player?.getCurrentTime() ?? 0;
              const duration = player?.getDuration() ?? 0;
              handleTimeUpdate(current, duration);
              handlePause();
            } else if (event.data === YT.PlayerState.ENDED) {
              const duration = player?.getDuration() ?? 0;
              handleTimeUpdate(duration, duration);
              handleEnded();
            }
          },
        },
      });

      pollId = window.setInterval(() => {
        if (!player || player.getPlayerState() !== YT.PlayerState.PLAYING) return;
        const current = player.getCurrentTime();
        const duration = player.getDuration();
        handleTimeUpdate(current, duration);
      }, 1000);
    });

    return () => {
      cancelled = true;
      if (pollId != null) window.clearInterval(pollId);
      player?.destroy();
      void flush();
    };
  }, [
    parsedYoutube?.videoId,
    tracking,
    youtubeContainerId,
    handlePlay,
    handlePause,
    handleTimeUpdate,
    handleEnded,
    flush,
  ]);

  const frame = parsedYoutube ? (
    tracking ? (
      <AspectRatio ratio={16 / 9} className="bg-black/25">
        <div
          ref={youtubeContainerRef}
          id={youtubeContainerId}
          className="absolute inset-0 h-full w-full"
        />
      </AspectRatio>
    ) : (
      <AspectRatio ratio={16 / 9} className="bg-black/25">
        <iframe
          {...({ credentialless: '' } as IframeHTMLAttributes<HTMLIFrameElement>)}
          src={youtubeEmbedUrl(parsedYoutube.videoId)}
          title="YouTube video"
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </AspectRatio>
    )
  ) : (
    <AspectRatio ratio={16 / 9} className="bg-black/25">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="absolute inset-0 h-full w-full object-contain"
        preload="metadata"
        onPlay={() => handlePlay()}
        onPause={() => {
          const el = videoRef.current;
          if (el) handleTimeUpdate(el.currentTime, el.duration);
          handlePause();
        }}
        onTimeUpdate={() => {
          const el = videoRef.current;
          if (!el) return;
          handleTimeUpdate(el.currentTime, el.duration);
        }}
        onSeeked={() => {
          const el = videoRef.current;
          if (el) handleSeeked(el.currentTime);
        }}
        onEnded={() => handleEnded()}
        onLoadedMetadata={() => {
          const el = videoRef.current;
          if (el) handleLoadedMetadata(el.duration);
        }}
      >
        <track kind="captions" />
      </video>
    </AspectRatio>
  );

  if (presentation === 'compact') {
    return (
      <div className={cn('overflow-hidden rounded-lg ring-1 ring-border/45 bg-muted/15', className)}>
        {frame}
      </div>
    );
  }

  if (presentation === 'reading') {
    return (
      <div className={cn(lessonActivityColumnClass, className)}>
        <ContentBlockShell variant="reading" className="overflow-hidden p-0">
          {frame}
        </ContentBlockShell>
      </div>
    );
  }

  return (
    <div className={cn('mx-auto w-full max-w-2xl', className)}>
      <ContentBlockShell variant="embedded" className="overflow-hidden p-0">
        {frame}
      </ContentBlockShell>
    </div>
  );
}
