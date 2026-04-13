import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Upload,
  X,
  FileText,
  Video,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Trash2,
  Plus,
  File,
  GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUploadResource, useCreateLinkResource, useDeleteResource } from '@/hooks/queries';
import type { SectionResource } from '@/types/syllabus';

interface ResourceUploaderProps {
  sectionId: string;
  classroomId: string;
  resources: SectionResource[];
  isRTL?: boolean;
}

const resourceTypeIcon: Record<string, React.ElementType> = {
  file: File,
  video: Video,
  link: LinkIcon,
  document: FileText,
  image: ImageIcon,
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ResourceUploader = ({
  sectionId,
  classroomId,
  resources,
  isRTL = false,
}: ResourceUploaderProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const uploadMutation = useUploadResource();
  const linkMutation = useCreateLinkResource();
  const deleteMutation = useDeleteResource();

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const file of fileArray) {
      try {
        await uploadMutation.mutateAsync({
          sectionId,
          file,
          orderIndex: resources.length + successCount,
          classroomId,
        });
        successCount++;
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (successCount > 0) {
      toast.success(t('syllabus.resources.uploaded', { count: successCount }));
    }
    setUploading(false);
  }, [sectionId, classroomId, resources.length, uploadMutation, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

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
        orderIndex: resources.length,
        classroomId,
      });
      setLinkTitle('');
      setLinkUrl('');
      setShowLinkForm(false);
      toast.success(t('syllabus.resources.linkAdded'));
    } catch {
      toast.error(t('syllabus.resources.linkFailed'));
    }
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

  return (
    <div className="space-y-3">
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Label className="text-xs font-medium flex items-center gap-1">
          <FileText className="h-3 w-3 text-muted-foreground" /> {t('syllabus.resources.title')}
        </Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowLinkForm(!showLinkForm)}
            className="h-6 text-xs text-primary"
          >
            <LinkIcon className="h-3 w-3 me-0.5" /> {t('syllabus.resources.addLink')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-6 text-xs text-primary"
          >
            <Plus className="h-3 w-3 me-0.5" /> {t('syllabus.resources.addFile')}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border hover:border-primary/40 bg-muted/10',
          uploading && 'pointer-events-none opacity-60'
        )}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">{t('syllabus.resources.uploading')}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {t('syllabus.resources.dropzone')}
            </span>
          </div>
        )}
      </div>

      {/* Link form */}
      {showLinkForm && (
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
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowLinkForm(false)} className="h-7 text-xs">
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddLink}
              disabled={linkMutation.isPending || !linkTitle.trim() || !linkUrl.trim()}
              className="h-7 text-xs gap-1"
            >
              {linkMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              {t('syllabus.resources.add')}
            </Button>
          </div>
        </div>
      )}

      {/* Resource list */}
      {resources.length > 0 && (
        <div className="space-y-1">
          {resources.map((resource) => {
            const Icon = resourceTypeIcon[resource.resource_type] || File;
            return (
              <div
                key={resource.id}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-card/50 group transition-all hover:bg-muted/30',
                  isRTL && 'flex-row-reverse'
                )}
              >
                <GripVertical className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                <div className="p-1.5 rounded-md bg-muted/50">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <span className="text-xs font-medium text-foreground truncate block">
                    {resource.title}
                  </span>
                  {resource.file_size && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatFileSize(resource.file_size)}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleDelete(resource); }}
                  disabled={deleteMutation.isPending}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
