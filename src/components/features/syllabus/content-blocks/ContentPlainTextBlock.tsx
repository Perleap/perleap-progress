import { cn } from '@/lib/utils';
import { ContentBlockShell } from './ContentBlockShell';
import { lessonActivityColumnClass } from './readingLayout';
import { LessonReadingDetailsCollapsible } from './LessonReadingDetailsCollapsible';

export type ContentPlainTextPresentation = 'reading' | 'embedded' | 'compact';

export function ContentPlainTextBlock({
  text,
  presentation,
  className,
}: {
  text: string;
  presentation: ContentPlainTextPresentation;
  className?: string;
}) {
  const prose = (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground sm:text-[0.9375rem]">{text}</p>
  );

  if (presentation === 'compact') {
    return (
      <div
        className={cn(
          'max-h-64 overflow-y-auto rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 ring-1 ring-border/30',
          className,
        )}
      >
        {prose}
      </div>
    );
  }

  if (presentation === 'reading') {
    return (
      <LessonReadingDetailsCollapsible className={className}>
        <ContentBlockShell
          variant="reading"
          className={cn(lessonActivityColumnClass, 'px-4 py-5 sm:px-5 sm:py-5')}
        >
          {prose}
        </ContentBlockShell>
      </LessonReadingDetailsCollapsible>
    );
  }

  return (
    <ContentBlockShell variant="embedded" className={cn('px-3 py-3 sm:px-4 sm:py-3.5', className)}>
      <div className="max-h-[min(22rem,50vh)] overflow-y-auto">{prose}</div>
    </ContentBlockShell>
  );
}
