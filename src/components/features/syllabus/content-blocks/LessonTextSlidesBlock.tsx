import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { RichTextViewer } from '@/components/ui/rich-text-editor';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
import { ContentBlockShell } from './ContentBlockShell';
import { lessonActivityColumnClass } from './readingLayout';
import { lessonTextBodyToHtml } from '@/lib/lessonRichText';
import { cn } from '@/lib/utils';

import type { ContentRichTextPresentation } from './ContentRichTextBlock';

type Props = {
  /** Raw rich-text fields (same format as a single `body` in lesson text blocks) */
  slideBodies: string[];
  presentation: ContentRichTextPresentation;
  isRTL: boolean;
  className?: string;
};

/**
 * 2+ HTML segments; single slide uses ContentRichTextBlock elsewhere.
 * Prev/next sit in side columns so they never cover the text.
 */
export function LessonTextSlidesBlock({ slideBodies, presentation, isRTL, className }: Props) {
  const { t } = useTranslation();
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [index, setIndex] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const count = slideBodies.length;

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      setIndex(api.selectedScrollSnap());
      setCanPrev(api.canScrollPrev());
      setCanNext(api.canScrollNext());
    };
    onSelect();
    api.on('reInit', onSelect);
    api.on('select', onSelect);
    return () => {
      api.off('reInit', onSelect);
      api.off('select', onSelect);
    };
  }, [api]);

  const isReading = presentation === 'reading';

  const shellClass = isReading
    ? cn(lessonActivityColumnClass, 'px-4 py-5 sm:px-5 sm:py-5')
    : 'px-3 py-3 sm:px-4 sm:py-3.5';

  const carouselBody = (
    <div
      className={cn('w-full min-w-0', className)}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex w-full min-w-0 items-stretch gap-1 sm:gap-2">
        <div className="flex w-9 shrink-0 items-center justify-center self-stretch sm:w-10">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full shadow-sm"
            disabled={!canPrev}
            aria-label={t('classroomDetail.activities.textSlides.prev')}
            onClick={() => api?.scrollPrev()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <Carousel
            className="w-full"
            setApi={setApi}
            opts={{ align: 'start', loop: false, direction: isRTL ? 'rtl' : 'ltr' }}
          >
            <CarouselContent className="ms-0">
              {slideBodies.map((raw, i) => (
                <CarouselItem key={i} className="ps-0 pe-0 basis-full">
                  <ContentBlockShell variant={isReading ? 'reading' : 'embedded'} className={shellClass}>
                    <div
                      className={cn(
                        isReading
                          ? ''
                          : 'max-h-[min(22rem,50vh)] overflow-y-auto [overflow-wrap:anywhere]',
                      )}
                    >
                      <RichTextViewer
                        content={lessonTextBodyToHtml(raw)}
                        variant="plain"
                        className="!rounded-none !border-0 !bg-transparent !shadow-none"
                      />
                    </div>
                  </ContentBlockShell>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>

        <div className="flex w-9 shrink-0 items-center justify-center self-stretch sm:w-10">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full shadow-sm"
            disabled={!canNext}
            aria-label={t('classroomDetail.activities.textSlides.next')}
            onClick={() => api?.scrollNext()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {count > 0 ? (
        <p
          className={cn(
            'mt-2 text-center text-xs text-muted-foreground',
            isRTL && 'text-center',
          )}
        >
          {t('classroomDetail.activities.textSlides.counter', { current: index + 1, count })}
        </p>
      ) : null}
    </div>
  );

  return carouselBody;
}
