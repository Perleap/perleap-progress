import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { FileText, GripVertical, Loader2, Plus, Trash2, Video } from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { LessonBlockV1 } from '@/types/syllabus';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { lessonTextBodyToHtml } from '@/lib/lessonRichText';
import { boundedPointerAutoScroll } from '@/lib/dndAutoScroll';
import { cn } from '@/lib/utils';
import { uploadResourceFile } from '@/services/syllabusResourceService';

const SortableLessonBlock = ({
  id,
  children,
}: {
  id: string;
  children: (args: {
    dragAttributes: DraggableAttributes;
    dragListeners: Record<string, unknown> | undefined;
  }) => React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform: rawTransform, transition, isDragging } = useSortable({
    id,
  });
  /** Without DragOverlay, core applies `adjustScale` from the hovered row’s rect vs the active row — small blocks stretch to match large neighbors. Keep unit scale while this row is the drag source. */
  const transform =
    rawTransform && isDragging ? { ...rawTransform, scaleX: 1, scaleY: 1 } : rawTransform;
  const style = {
    transform: CSS.Transform.toString(transform),
    /** No transition while dragging — avoids soft/blurred interpolation over underlying text. */
    transition: isDragging ? undefined : transition,
  };
  return (
    <div ref={setNodeRef} style={style} className={cn('w-full', isDragging && 'z-10')}>
      <Card
        size="sm"
        className={cn(
          'gap-0 py-0 shadow-sm transition-shadow bg-card',
          isDragging && 'ring-2 ring-primary/40 shadow-lg'
        )}
      >
        <CardContent className="px-3 py-3 sm:px-4">
          {children({ dragAttributes: attributes, dragListeners: listeners })}
        </CardContent>
      </Card>
    </div>
  );
};

export interface LessonBlocksEditorProps {
  sectionId: string;
  blocks: LessonBlockV1[];
  /** Supports functional updates so async upload/reorder never clobber each other. */
  onChange: Dispatch<SetStateAction<LessonBlockV1[]>>;
  isRTL: boolean;
  /** True while save mutation is in flight; does not include background video upload. */
  disabled?: boolean;
  onRephraseBlock: (blockId: string) => Promise<void>;
  rephrasingBlockId: string | null;
  /** While a video is uploading to storage */
  onUploadStateChange?: (busy: boolean) => void;
}

export const LessonBlocksEditor = ({
  sectionId,
  blocks,
  onChange,
  isRTL,
  disabled = false,
  onRephraseBlock,
  rephrasingBlockId,
  onUploadStateChange,
}: LessonBlocksEditorProps) => {
  const { t } = useTranslation();
  const [uploadTarget, setUploadTarget] = useState<{ blockId: string; fileName: string } | null>(
    null
  );
  useEffect(() => {
    onUploadStateChange?.(!!uploadTarget);
  }, [uploadTarget, onUploadStateChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = blocks.map((b) => b.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onChange((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === String(active.id));
      const newIndex = prev.findIndex((b) => b.id === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const addText = () => {
    onChange((prev) => [...prev, { id: crypto.randomUUID(), type: 'text' as const, body: '' }]);
  };

  const addVideo = () => {
    onChange((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: 'video' as const,
        url: null,
        file_path: null,
        mime_type: null,
        file_size: null,
        display_name: '',
      },
    ]);
  };

  const removeBlock = (blockId: string) => {
    onChange((prev) => prev.filter((b) => b.id !== blockId));
  };

  const updateText = (blockId: string, body: string) => {
    onChange((prev) =>
      prev.map((b) => (b.id === blockId && b.type === 'text' ? { ...b, body } : b))
    );
  };

  const handleVideoFile = async (blockId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !sectionId) return;
    setUploadTarget({ blockId, fileName: file.name });
    try {
      const up = await uploadResourceFile(sectionId, file);
      if ('error' in up) {
        toast.error(up.error);
        return;
      }
      onChange((prev) =>
        prev.map((b) =>
          b.id === blockId && b.type === 'video'
            ? {
                ...b,
                file_path: up.filePath,
                url: up.publicUrl,
                mime_type: file.type || null,
                file_size: file.size,
                display_name: file.name,
              }
            : b
        )
      );
    } finally {
      setUploadTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className={cn('flex flex-wrap items-center gap-2', isRTL && 'flex-row-reverse')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              className="shrink-0"
              aria-label={t('classroomDetail.activities.addBlockAriaLabel')}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-[10rem]"
            align={isRTL ? 'end' : 'start'}
            sideOffset={4}
          >
            <DropdownMenuItem
              onClick={() => {
                addText();
              }}
              className="gap-2"
            >
              <FileText className="size-4" />
              {t('classroomDetail.activities.addBlockMenuText')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                addVideo();
              }}
              className="gap-2"
            >
              <Video className="size-4" />
              {t('classroomDetail.activities.addBlockMenuVideo')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('classroomDetail.activities.blocksEmptyHint')}
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          autoScroll={boundedPointerAutoScroll}
          /** Modifiers: vertical only; no `restrictToFirstScrollableAncestor` (it blocked dragging near the footer). */
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="w-full min-w-0 space-y-3 [contain:layout]">
              {blocks.map((block) => {
                const uploadingHere = uploadTarget?.blockId === block.id;
                return (
                  <li key={block.id} className="w-full">
                    {block.type === 'text' ? (
                      <SortableLessonBlock id={block.id}>
                        {({ dragAttributes, dragListeners }) => (
                          <div className={cn('flex gap-2', isRTL && 'flex-row-reverse')}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'mt-1 h-9 w-9 shrink-0 touch-none text-muted-foreground',
                                disabled && 'pointer-events-none opacity-50'
                              )}
                              aria-label={t('classroomDetail.activities.blockDragHandle')}
                              {...dragAttributes}
                              {...dragListeners}
                            >
                              <GripVertical className="h-4 w-4" />
                            </Button>
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className={cn(rephrasingBlockId === block.id && 'opacity-90')}>
                                <RichTextEditor
                                  content={lessonTextBodyToHtml(block.body)}
                                  onChange={(html) => updateText(block.id, html)}
                                  placeholder={t('classroomDetail.activities.richTextPlaceholder')}
                                  className="min-h-[220px]"
                                  disabled={disabled || rephrasingBlockId === block.id}
                                  dir={isRTL ? 'rtl' : 'ltr'}
                                  onRewrite={() => void onRephraseBlock(block.id)}
                                  isRewriting={rephrasingBlockId === block.id}
                                />
                              </div>
                              <div className={cn('flex', isRTL && 'justify-start')}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => removeBlock(block.id)}
                                  disabled={disabled}
                                >
                                  <Trash2 className="me-1 h-3.5 w-3.5" />
                                  {t('classroomDetail.activities.removeBlock')}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </SortableLessonBlock>
                    ) : (
                      <SortableLessonBlock id={block.id}>
                        {({ dragAttributes, dragListeners }) => (
                          <div className={cn('flex gap-2', isRTL && 'flex-row-reverse')}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'mt-1 h-9 w-9 shrink-0 touch-none text-muted-foreground',
                                disabled && 'pointer-events-none opacity-50'
                              )}
                              aria-label={t('classroomDetail.activities.blockDragHandle')}
                              {...dragAttributes}
                              {...dragListeners}
                            >
                              <GripVertical className="h-4 w-4" />
                            </Button>
                            <div className="min-w-0 flex-1 space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">
                                {t('classroomDetail.activities.activityVideoFile')}
                              </p>
                              <input
                                id={`lesson-video-${block.id}`}
                                type="file"
                                accept="video/*"
                                className="sr-only"
                                tabIndex={-1}
                                disabled={disabled || uploadingHere}
                                onChange={(e) => void handleVideoFile(block.id, e)}
                              />
                              <div
                                className={cn(
                                  'flex flex-wrap items-center gap-x-3 gap-y-2',
                                  isRTL && 'flex-row-reverse'
                                )}
                              >
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={disabled || uploadingHere}
                                  onClick={() =>
                                    document.getElementById(`lesson-video-${block.id}`)?.click()
                                  }
                                >
                                  {t('classroomDetail.activities.chooseVideoFile')}
                                </Button>
                                <div
                                  className={cn(
                                    'flex min-w-0 max-w-full items-center gap-2 text-sm text-muted-foreground',
                                    isRTL && 'flex-row-reverse'
                                  )}
                                >
                                  {uploadingHere && uploadTarget ? (
                                    <>
                                      <span
                                        className="min-w-0 truncate"
                                        title={uploadTarget.fileName}
                                      >
                                        {uploadTarget.fileName}
                                      </span>
                                      <Loader2
                                        className="h-3.5 w-3.5 shrink-0 animate-spin"
                                        aria-hidden
                                      />
                                      <span className="sr-only">
                                        {t('classroomDetail.activities.videoUploading')}
                                      </span>
                                    </>
                                  ) : block.url || block.file_path ? (
                                    <span
                                      className="min-w-0 truncate"
                                      title={block.display_name || undefined}
                                    >
                                      {block.display_name ||
                                        block.file_path?.split('/').pop() ||
                                        block.url}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {t('classroomDetail.activities.activityVideoFileHint')}
                              </p>
                              <div className={cn('flex', isRTL && 'justify-start')}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => removeBlock(block.id)}
                                  disabled={disabled || uploadingHere}
                                >
                                  <Trash2 className="me-1 h-3.5 w-3.5" />
                                  {t('classroomDetail.activities.removeBlock')}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </SortableLessonBlock>
                    )}
                  </li>
                );
              })}
            </ul>
          </SortableContext>
          {/* Fixed end cap: bounds max scroll + drop affordance below the last real block */}
          <div
            aria-hidden
            className="pointer-events-none mt-3 min-h-[5rem] w-full shrink-0 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/25"
          />
        </DndContext>
      )}
    </div>
  );
};
