import { AspectRatio } from '@/components/ui/aspect-ratio';
import { cn } from '@/lib/utils';
import { parseYoutubeUrl, youtubeEmbedUrl } from '@/lib/youtube';
import type { LessonVideoSource } from '@/types/syllabus';
import { ContentBlockShell } from './ContentBlockShell';
import { lessonActivityColumnClass } from './readingLayout';

export type ContentVideoPresentation = 'reading' | 'embedded' | 'compact';

export function ContentVideoBlock({
  videoUrl,
  source,
  presentation,
  className,
}: {
  videoUrl: string;
  source?: LessonVideoSource;
  presentation: ContentVideoPresentation;
  className?: string;
}) {
  const parsedYoutube =
    source === 'youtube' || (source !== 'upload' && parseYoutubeUrl(videoUrl))
      ? parseYoutubeUrl(videoUrl)
      : null;

  const frame = parsedYoutube ? (
    <AspectRatio ratio={16 / 9} className="bg-black/25">
      <iframe
        src={youtubeEmbedUrl(parsedYoutube.videoId)}
        title="YouTube video"
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </AspectRatio>
  ) : (
    <AspectRatio ratio={16 / 9} className="bg-black/25">
      <video
        src={videoUrl}
        controls
        className="absolute inset-0 h-full w-full object-contain"
        preload="metadata"
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
