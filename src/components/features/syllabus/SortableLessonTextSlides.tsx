import { useLayoutEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { GripVertical, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { lessonTextBodyToHtml } from '@/lib/lessonRichText';
import { boundedPointerAutoScroll } from '@/lib/dndAutoScroll';
import { cn } from '@/lib/utils';

function SortableSlideRow({
  id,
  children,
}: {
  id: string;
  children: (args: {
    dragProps: { attributes: DraggableAttributes; listeners: DraggableSyntheticListeners | undefined };
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform: rawTransform, transition, isDragging } =
    useSortable({ id });
  const transform = rawTransform && isDragging ? { ...rawTransform, scaleX: 1, scaleY: 1 } : rawTransform;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  };
  return (
    <li ref={setNodeRef} style={style} className={cn('w-full', isDragging && 'z-10')}>
      {children({ dragProps: { attributes, listeners }, isDragging })}
    </li>
  );
}

export interface SortableLessonTextSlidesProps {
  blockId: string;
  slides: string[];
  isRTL: boolean;
  disabled: boolean;
  rephrasingBlockId: string | null;
  onReorderSlides: (reordered: string[]) => void;
  onUpdateSlide: (slideIndex: number, html: string) => void;
  onRemoveSlide: (slideIndex: number) => void;
  onRephraseBlock: (blockId: string) => Promise<void>;
}

/**
 * Nested vertical sortable list for a single text block's slides; stable row ids for dnd-kit.
 */
export function SortableLessonTextSlides({
  blockId,
  slides,
  isRTL,
  disabled,
  rephrasingBlockId,
  onReorderSlides,
  onUpdateSlide,
  onRemoveSlide,
  onRephraseBlock,
}: SortableLessonTextSlidesProps) {
  const { t } = useTranslation();
  const [rowIds, setRowIds] = useState(() => slides.map(() => crypto.randomUUID()));

  useLayoutEffect(() => {
    setRowIds((prev) => {
      if (prev.length === slides.length) return prev;
      if (slides.length > prev.length) {
        return [
          ...prev,
          ...Array.from(
            { length: slides.length - prev.length },
            () => crypto.randomUUID(),
          ),
        ];
      }
      return prev.slice(0, slides.length);
    });
  }, [slides.length, blockId]);

  const innerSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rowIds.findIndex((rid) => rid === String(active.id));
    const newIndex = rowIds.findIndex((rid) => rid === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderSlides(arrayMove(slides, oldIndex, newIndex));
    setRowIds((prev) => arrayMove(prev, oldIndex, newIndex));
  };

  // restrictToParentElement + overflow-clip: keep slide drag from crossing below the list (and over Remove block).
  return (
    <DndContext
      sensors={innerSensors}
      collisionDetection={closestCenter}
      autoScroll={boundedPointerAutoScroll}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full min-h-0 overflow-clip [contain:layout]">
        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
          <ul className="w-full min-w-0 space-y-3">
            {slides.map((slideBody, slideIdx) => {
              const sortId = rowIds[slideIdx];
              if (!sortId) return null;
              return (
                <SortableSlideRow id={sortId} key={sortId}>
                  {({ dragProps, isDragging }) => (
                    <Card
                      size="sm"
                      className={cn(
                        'border-border/60 bg-muted/5 shadow-sm transition-shadow',
                        isDragging && 'ring-2 ring-primary/40 shadow-lg',
                      )}
                    >
                      <CardContent className="p-3 sm:p-3">
                        <div className={cn('flex gap-2', isRTL && 'flex-row-reverse')}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              'mt-0.5 h-9 w-9 shrink-0 touch-none text-muted-foreground',
                              disabled && 'pointer-events-none opacity-50',
                            )}
                            aria-label={t('classroomDetail.activities.textSlides.dragSlide')}
                            {...dragProps.attributes}
                            {...dragProps.listeners}
                          >
                            <GripVertical className="h-4 w-4" />
                          </Button>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div
                              className={cn(
                                'flex flex-wrap items-center justify-between gap-2',
                                isRTL && 'flex-row-reverse',
                              )}
                            >
                              <span className="text-xs font-medium text-muted-foreground">
                                {t('classroomDetail.activities.textSlides.slideLabel', {
                                  n: slideIdx + 1,
                                })}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={disabled}
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => onRemoveSlide(slideIdx)}
                              >
                                <Trash2 className="me-1 h-3.5 w-3.5" />
                                {t('classroomDetail.activities.textSlides.removeSlide')}
                              </Button>
                            </div>
                            <div
                              className={cn(
                                rephrasingBlockId === blockId && slideIdx === 0 && 'opacity-90',
                              )}
                            >
                              <RichTextEditor
                                content={lessonTextBodyToHtml(slideBody)}
                                onChange={(html) => onUpdateSlide(slideIdx, html)}
                                placeholder={t('classroomDetail.activities.richTextPlaceholder')}
                                className="min-h-[180px]"
                                disabled={disabled || rephrasingBlockId === blockId}
                                dir={isRTL ? 'rtl' : 'ltr'}
                                onRewrite={
                                  slideIdx === 0
                                    ? () => void onRephraseBlock(blockId)
                                    : undefined
                                }
                                isRewriting={rephrasingBlockId === blockId && slideIdx === 0}
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </SortableSlideRow>
              );
            })}
          </ul>
        </SortableContext>
      </div>
    </DndContext>
  );
}
