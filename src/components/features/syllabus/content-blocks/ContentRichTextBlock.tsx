import { RichTextViewer } from '@/components/ui/rich-text-editor';
import { cn } from '@/lib/utils';
import { ContentBlockShell } from './ContentBlockShell';
import { lessonActivityColumnClass } from './readingLayout';

export type ContentRichTextPresentation = 'reading' | 'embedded';

export function ContentRichTextBlock({
  html,
  presentation,
  className,
}: {
  html: string;
  presentation: ContentRichTextPresentation;
  className?: string;
}) {
  if (presentation === 'reading') {
    return (
      <ContentBlockShell
        variant="reading"
        className={cn(lessonActivityColumnClass, 'px-4 py-5 sm:px-5 sm:py-5', className)}
      >
        <RichTextViewer
          content={html}
          variant="plain"
          className="!rounded-none !border-0 !bg-transparent !shadow-none"
        />
      </ContentBlockShell>
    );
  }
  return (
    <ContentBlockShell variant="embedded" className={cn('px-3 py-3 sm:px-4 sm:py-3.5', className)}>
      <div className="max-h-[min(22rem,50vh)] overflow-y-auto">
        <RichTextViewer content={html} variant="plain" />
      </div>
    </ContentBlockShell>
  );
}
