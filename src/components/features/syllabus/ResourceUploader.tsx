import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DraggableAttributes,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS, type Transform } from '@dnd-kit/utilities';
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { boundedPointerAutoScroll } from '@/lib/dndAutoScroll';
import {
  Upload,
  FileText,
  Video,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Trash2,
  Plus,
  File,
  GripVertical,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useUploadResource,
  useCreateLinkResource,
  useDeleteResource,
  useReorderSectionResources,
} from '@/hooks/queries';
import type { SectionResource } from '@/types/syllabus';
import { formatResourceFileSize, isResourceFileWithinSizeLimit } from '@/lib/resourceUploadValidation';
import { Progress, ProgressValue } from '@/components/ui/progress';

interface ResourceUploaderProps {
  sectionId: string;
  classroomId: string;
  resources: SectionResource[];
  isRTL?: boolean;
  /** When parent passes only a subset of section rows (e.g. outline materials), use max(order_index)+1 from all section resources. */
  nextOrderIndex?: number;
}

type AddMode = 'none' | 'link' | 'file';

const resourceTypeIcon: Record<string, React.ElementType> = {
  file: File,
  video: Video,
  link: LinkIcon,
  document: FileText,
  image: ImageIcon,
};

function formatFileSize(bytes: number | null): string {
  return formatResourceFileSize(bytes);
}

function sanitizeDownloadFilename(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'file';
  return trimmed.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 180);
}

function downloadFilenameForResource(resource: SectionResource): string {
  let name = sanitizeDownloadFilename(resource.title);
  if (!name.includes('.') && resource.file_path) {
    const base = resource.file_path.split('/').pop() ?? '';
    const dot = base.lastIndexOf('.');
    if (dot > 0 && dot < base.length - 1) {
      const ext = base.slice(dot + 1);
      if (/^[a-z0-9]+$/i.test(ext) && ext.length <= 10) {
        name = `${name}.${ext}`;
      }
    }
  }
  return name;
}

function restrictDragToBoundingRect(
  transform: Transform,
  rect: { top: number; bottom: number; left: number; right: number },
  boundingRect: DOMRect,
): Transform {
  const value = { ...transform };
  const bHeight = boundingRect.bottom - boundingRect.top;
  const bWidth = boundingRect.right - boundingRect.left;
  if (rect.top + transform.y <= boundingRect.top) {
    value.y = boundingRect.top - rect.top;
  } else if (rect.bottom + transform.y >= boundingRect.top + bHeight) {
    value.y = boundingRect.top + bHeight - rect.bottom;
  }
  if (rect.left + transform.x <= boundingRect.left) {
    value.x = boundingRect.left - rect.left;
  } else if (rect.right + transform.x >= boundingRect.left + bWidth) {
    value.x = boundingRect.left + bWidth - rect.right;
  }
  return value;
}

/** Keeps drag preview inside the Resources block (above Module flow). */
function createRestrictToResourcesSectionModifier(
  getBoundary: () => DOMRect | undefined,
): Modifier {
  return ({ transform, draggingNodeRect, overlayNodeRect }) => {
    const rect = overlayNodeRect ?? draggingNodeRect;
    const boundary = getBoundary();
    if (!rect || !boundary) return transform;
    const next = restrictDragToBoundingRect(transform, rect, boundary);
    return next;
  };
}

function SortableResourceRow({
  id,
  children,
}: {
  id: string;
  children: (args: {
    dragAttributes: DraggableAttributes;
    dragListeners: Record<string, unknown> | undefined;
  }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0 : undefined,
  };
  return (
    <li ref={setNodeRef} style={style} className={cn('list-none', isDragging && 'z-10')}>
      {children({ dragAttributes: attributes, dragListeners: listeners })}
    </li>
  );
}

const RESOURCE_TYPE_I18N_KEYS: Record<string, string> = {
  file: 'syllabus.resources.typeFile',
  video: 'syllabus.resources.typeVideo',
  link: 'syllabus.resources.typeLink',
  document: 'syllabus.resources.typeDocument',
  image: 'syllabus.resources.typeImage',
  text: 'syllabus.resources.typeText',
  lesson: 'syllabus.resources.typeLesson',
};

export const ResourceUploader = ({
  sectionId,
  classroomId,
  resources,
  isRTL = false,
  nextOrderIndex,
}: ResourceUploaderProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string; percent: number } | null>(null);
  const [addMode, setAddMode] = useState<AddMode>('none');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const uploadMutation = useUploadResource();
  const linkMutation = useCreateLinkResource();
  const deleteMutation = useDeleteResource();
  const reorderMutation = useReorderSectionResources();

  const baseOrderIndex = nextOrderIndex ?? resources.length;

  const resourcesSig = useMemo(
    () => resources.map((r) => `${r.id}:${r.order_index}`).join('|'),
    [resources],
  );

  const resourcesRef = useRef(resources);
  resourcesRef.current = resources;

  const [ordered, setOrdered] = useState<SectionResource[]>(() =>
    [...resources].sort((a, b) => a.order_index - b.order_index),
  );

  useEffect(() => {
    const list = resourcesRef.current;
    setOrdered([...list].sort((a, b) => a.order_index - b.order_index));
  }, [resourcesSig]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortableIds = useMemo(() => ordered.map((r) => r.id), [ordered]);

  const resourcesSectionElRef = useRef<HTMLDivElement>(null);
  const restrictToResourcesSectionModifier = useMemo(
    () =>
      createRestrictToResourcesSectionModifier(() =>
        resourcesSectionElRef.current?.getBoundingClientRect(),
      ),
    [],
  );

  const clearLinkForm = () => {
    setLinkTitle('');
    setLinkUrl('');
  };

  const resourceTypeLine = useCallback(
    (type: string) => {
      const key = RESOURCE_TYPE_I18N_KEYS[type] ?? 'syllabus.resources.typeFile';
      return t(key);
    },
    [t],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      setUploading(true);
      let successCount = 0;

      for (const file of fileArray) {
        if (!isResourceFileWithinSizeLimit(file)) {
          toast.error(t('syllabus.resources.fileTooLarge', { name: file.name }));
          continue;
        }

        try {
          setUploadProgress({ fileName: file.name, percent: 0 });
          await uploadMutation.mutateAsync({
            sectionId,
            file,
            orderIndex: baseOrderIndex + successCount,
            classroomId,
            onProgress: (loaded, total) => {
              if (total <= 0) return;
              setUploadProgress({
                fileName: file.name,
                percent: Math.round((loaded / total) * 100),
              });
            },
          });
          successCount++;
        } catch (err) {
          const msg =
            err && typeof err === 'object' && 'message' in err
              ? String((err as { message: string }).message)
              : '';
          if (msg === 'STORAGE_GLOBAL_LIMIT_EXCEEDED') {
            toast.error(t('syllabus.resources.uploadGlobalLimitExceeded'));
          } else {
            toast.error(t('syllabus.resources.uploadFailed', { name: file.name }));
          }
        }
      }

      if (successCount > 0) {
        toast.success(t('syllabus.resources.uploaded', { count: successCount }));
        setAddMode('none');
      }
      setUploadProgress(null);
      setUploading(false);
    },
    [sectionId, classroomId, baseOrderIndex, uploadMutation, t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        void handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleAddLink = async () => {
    if (!linkTitle.trim() || !linkUrl.trim()) {
      toast.error(t('syllabus.resources.linkFieldsRequired'));
      return;
    }
    try {
      await linkMutation.mutateAsync({
        sectionId,
        title: linkTitle,
        url: linkUrl,
        orderIndex: baseOrderIndex,
        classroomId,
      });
      clearLinkForm();
      setAddMode('none');
      toast.success(t('syllabus.resources.linkAdded'));
    } catch {
      toast.error(t('syllabus.resources.linkFailed'));
    }
  };

  const cancelAdd = () => {
    setAddMode('none');
    clearLinkForm();
  };

  const handlePickFileMode = () => {
    setAddMode('file');
    requestAnimationFrame(() => {
      fileInputRef.current?.click();
    });
  };

  const handleDelete = async (resource: SectionResource) => {
    try {
      await deleteMutation.mutateAsync({
        resourceId: resource.id,
        filePath: resource.file_path,
        sectionId,
        classroomId,
      });
      toast.success(t('syllabus.resources.deleted'));
    } catch {
      toast.error(t('syllabus.resources.deleteFailed'));
    }
  };

  const handleListDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleListDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ordered.findIndex((r) => r.id === String(active.id));
    const newIndex = ordered.findIndex((r) => r.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const snapshot = ordered;
    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next);

    const slots = [...snapshot.map((r) => r.order_index)].sort((a, b) => a - b);
    const updates = next.map((r, i) => ({
      resourceId: r.id,
      order_index: slots[i] ?? i,
    }));

    try {
      await reorderMutation.mutateAsync({
        sectionId,
        classroomId,
        updates,
      });
      toast.success(t('syllabus.resources.orderSaved'));
    } catch {
      setOrdered(snapshot);
      toast.error(t('syllabus.resources.reorderFailed'));
    }
  };

  const handleListDragCancel = () => {
    setActiveDragId(null);
  };

  const activeResource =
    activeDragId != null ? ordered.find((r) => r.id === activeDragId) : null;

  const openOrDownloadResource = useCallback(
    async (resource: SectionResource) => {
      const u = resource.url?.trim();
      if (!u) return;

      if (resource.resource_type === 'link') {
        window.open(u, '_blank', 'noopener,noreferrer');
        return;
      }

      try {
        const res = await fetch(u, { mode: 'cors' });
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const filename = downloadFilenameForResource(resource);
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
      } catch {
        window.open(u, '_blank', 'noopener,noreferrer');
        toast.info(t('syllabus.resources.downloadOpenedInTab'));
      }
    },
    [t],
  );

  return (
    <div ref={resourcesSectionElRef} className="space-y-3">
      <div
        className={cn('flex items-start gap-3 justify-between', isRTL && 'flex-row-reverse')}
      >
        <div
          className={cn(
            'min-w-0 flex-1 space-y-1',
            isRTL ? 'text-right' : 'text-left',
          )}
        >
          <div className="text-sm font-semibold text-foreground">
            {t('syllabus.resources.title')}
          </div>
          <p className="text-sm text-muted-foreground">{t('syllabus.resources.sectionHint')}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 self-start rounded-lg mt-0.5"
              aria-label={t('syllabus.resources.addResource', 'Add resource')}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onClick={() => {
                setAddMode('link');
                clearLinkForm();
              }}
            >
              <LinkIcon className="h-4 w-4" />
              {t('syllabus.resources.addLink')}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2" onClick={handlePickFileMode}>
              <Upload className="h-4 w-4" />
              {t('syllabus.resources.addFile')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,image/*,application/pdf,*/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {addMode === 'file' && (
        <div className="p-3 rounded-xl border border-border bg-card space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              'border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer',
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border hover:border-primary/40 bg-muted/10',
              uploading && 'pointer-events-none opacity-60',
            )}
            onClick={() => !uploading && fileInputRef.current?.click()}
            role="presentation"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2 py-2 w-full px-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">
                  {uploadProgress
                    ? t('syllabus.resources.uploadingFile', { name: uploadProgress.fileName })
                    : t('syllabus.resources.uploading')}
                </span>
                {uploadProgress ? (
                  <Progress value={uploadProgress.percent} className="w-full">
                    <ProgressValue />
                  </Progress>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 py-1">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{t('syllabus.resources.dropzone')}</span>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={cancelAdd} className="h-7 text-xs">
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}

      {addMode === 'link' && (
        <div className="p-3 rounded-xl border border-border bg-card space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="space-y-1">
            <Input
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder={t('syllabus.resources.linkTitlePlaceholder')}
              className="rounded-lg h-8 text-xs"
              autoDirection
            />
          </div>
          <div className="space-y-1">
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="rounded-lg h-8 text-xs"
              dir="ltr"
            />
          </div>
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={cancelAdd} className="h-7 text-xs">
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleAddLink()}
              disabled={linkMutation.isPending || !linkTitle.trim() || !linkUrl.trim()}
              className="h-7 text-xs gap-1"
            >
              {linkMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              {t('syllabus.resources.add')}
            </Button>
          </div>
        </div>
      )}

      {ordered.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          autoScroll={boundedPointerAutoScroll}
          modifiers={[
            restrictToVerticalAxis,
            restrictToFirstScrollableAncestor,
            restrictToResourcesSectionModifier,
          ]}
          onDragStart={handleListDragStart}
          onDragEnd={(e) => void handleListDragEnd(e)}
          onDragCancel={handleListDragCancel}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <ul className="min-w-0 space-y-2 [contain:layout]">
              {ordered.map((resource) => {
                const Icon = resourceTypeIcon[resource.resource_type] || File;
                const canOpen = Boolean(resource.url?.trim());
                const isLink = resource.resource_type === 'link';
                return (
                  <SortableResourceRow key={resource.id} id={resource.id}>
                    {({ dragAttributes, dragListeners }) => (
                      <div
                        className={cn(
                          'flex min-w-0 items-center gap-3',
                          isRTL && 'flex-row-reverse',
                        )}
                      >
                        <div
                          className={cn(
                            'flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-card p-3',
                            isRTL && 'flex-row-reverse',
                            activeDragId === resource.id && 'ring-2 ring-primary/25 shadow-md',
                          )}
                        >
                          <button
                            type="button"
                            className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 rounded-md shrink-0"
                            aria-label={t('classroomDetail.activitiesFlow.dragReorder')}
                            {...dragListeners}
                            {...dragAttributes}
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <div className="p-1.5 rounded-md bg-muted/50 shrink-0">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className={`min-w-0 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                            <span className="text-sm font-medium text-foreground truncate block">
                              {resource.title}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {resourceTypeLine(resource.resource_type)}
                              {resource.file_size ? ` · ${formatFileSize(resource.file_size)}` : ''}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {canOpen ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                                aria-label={
                                  isLink
                                    ? t('syllabus.resources.openInNewTab')
                                    : t('syllabus.resources.download')
                                }
                                onClick={() => void openOrDownloadResource(resource)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-destructive"
                              onClick={() => void handleDelete(resource)}
                              disabled={deleteMutation.isPending}
                              aria-label={t('syllabus.resources.deleteResourceAria')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </SortableResourceRow>
                );
              })}
            </ul>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeResource ? (
              <div
                className={cn(
                  'flex min-w-0 items-center gap-3 shadow-xl will-change-transform [backface-visibility:hidden]',
                  isRTL && 'flex-row-reverse',
                )}
              >
                <div
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-card p-3 ring-2 ring-primary/25',
                    isRTL && 'flex-row-reverse',
                  )}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {activeResource.title}
                  </span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
};
