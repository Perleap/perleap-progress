import { cn } from '@/lib/utils';
import { ContentBlockShell } from './ContentBlockShell';
import { lessonActivityColumnClass } from './readingLayout';

export type ContentImagePresentation = 'reading' | 'embedded' | 'compact';

export function ContentImageBlock({
  src,
  alt,
  caption,
  presentation,
  className,
}: {
  src: string;
  alt: string;
  caption?: string | null;
  presentation: ContentImagePresentation;
  className?: string;
}) {
  const img = (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="mx-auto block h-auto w-full max-h-[min(28rem,65vh)] object-contain"
    />
  );

  const body = (
    <>
      <div className="bg-muted/10">{img}</div>
      {caption?.trim() ? (
        <p className="border-t border-border/40 px-4 py-2.5 text-sm text-muted-foreground">{caption.trim()}</p>
      ) : null}
    </>
  );

  if (presentation === 'compact') {
    return (
      <div className={cn('overflow-hidden rounded-lg ring-1 ring-border/45 bg-muted/10', className)}>
        {body}
      </div>
    );
  }

  if (presentation === 'reading') {
    return (
      <div className={cn(lessonActivityColumnClass, className)}>
        <ContentBlockShell variant="reading" className="overflow-hidden p-0">
          {body}
        </ContentBlockShell>
      </div>
    );
  }

  return (
    <ContentBlockShell variant="embedded" className={cn('overflow-hidden p-0', className)}>
      {body}
    </ContentBlockShell>
  );
}
