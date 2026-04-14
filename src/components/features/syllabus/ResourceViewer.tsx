import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  FileText,
  Video,
  Image as ImageIcon,
  Link as LinkIcon,
  Download,
  ExternalLink,
  File,
  Play,
  X,
} from 'lucide-react';
import type { SectionResource } from '@/types/syllabus';

interface ResourceViewerProps {
  resources: SectionResource[];
  isRTL?: boolean;
  compact?: boolean;
}

const resourceTypeConfig: Record<string, { icon: React.ElementType; color: string }> = {
  file: { icon: File, color: 'text-muted-foreground' },
  video: { icon: Video, color: 'text-blue-500' },
  link: { icon: LinkIcon, color: 'text-green-500' },
  document: { icon: FileText, color: 'text-orange-500' },
  image: { icon: ImageIcon, color: 'text-purple-500' },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Matches `ResourcePreview` so mis-typed `resource_type` still shows inline player. */
function resourceHasInlinePreview(resource: SectionResource): boolean {
  if (resource.resource_type === 'link') return false;
  const mime = resource.mime_type || '';
  if (resource.resource_type === 'image' || mime.startsWith('image/')) return true;
  if (resource.resource_type === 'video' || mime.startsWith('video/')) return true;
  if (mime === 'application/pdf') return true;
  return false;
}

function isVideoResource(resource: SectionResource): boolean {
  const mime = resource.mime_type || '';
  return resource.resource_type === 'video' || mime.startsWith('video/');
}

/** Video waits for user Open; images/PDF show immediately. */
function shouldShowInlinePreview(resource: SectionResource, videoRevealed: boolean): boolean {
  if (resource.resource_type === 'link') return false;
  if (isVideoResource(resource)) return videoRevealed;
  return resourceHasInlinePreview(resource);
}

/** Fetch then save via blob URL so browsers save instead of navigating (e.g. JSON). */
async function triggerBrowserDownload(url: string, filename: string): Promise<boolean> {
  const safeName = filename.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'download';
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = safeName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return true;
  } catch {
    return false;
  }
}

function ResourcePreview({ resource }: { resource: SectionResource }) {
  const url = resource.url || '';
  const mime = resource.mime_type || '';

  if (resource.resource_type === 'image' || mime.startsWith('image/')) {
    return (
      <div className="rounded-lg overflow-hidden border border-border bg-muted/20 mb-2">
        <img
          src={url}
          alt={resource.title}
          className="w-full max-h-64 object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  if (resource.resource_type === 'video' || mime.startsWith('video/')) {
    return (
      <div className="flex justify-center items-center rounded-lg overflow-hidden border border-border bg-muted/20 mb-2 py-2 px-2">
        <video
          src={url}
          controls
          className="max-h-72 max-w-full h-auto w-auto"
          preload="metadata"
        >
          <track kind="captions" />
        </video>
      </div>
    );
  }

  if (mime === 'application/pdf') {
    return (
      <div className="rounded-lg overflow-hidden border border-border mb-2">
        <iframe
          src={`${url}#toolbar=0`}
          title={resource.title}
          className="w-full h-72 bg-white"
        />
      </div>
    );
  }

  return null;
}

function ResourceCard({ resource, isRTL, compact }: {
  resource: SectionResource;
  isRTL: boolean;
  compact: boolean;
}) {
  const { t } = useTranslation();
  const [videoRevealed, setVideoRevealed] = useState(false);
  const config = resourceTypeConfig[resource.resource_type] || resourceTypeConfig.file;
  const Icon = config.icon;
  const url = resource.url || '';
  const isLink = resource.resource_type === 'link';
  const isVideo = isVideoResource(resource);
  const hasPreview = resourceHasInlinePreview(resource);
  const showPreview = shouldShowInlinePreview(resource, videoRevealed);
  const useOpenAction = hasPreview || isLink;

  const handleOpen = async () => {
    if (isVideo && !videoRevealed) {
      setVideoRevealed(true);
      return;
    }
    if (!useOpenAction && url) {
      const ok = await triggerBrowserDownload(url, resource.title);
      if (ok) return;
      toast.message(t('syllabus.resources.downloadOpenedInTab'));
    }
    if (url) window.open(url, '_blank', 'noopener');
  };

  if (compact) {
    return (
      <button
        onClick={handleOpen}
        className={cn(
          'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border border-border bg-card/50',
          'hover:bg-muted/30 hover:border-primary/30 transition-all group text-left',
          isRTL && 'flex-row-reverse text-right'
        )}
      >
        <div className={cn('p-1.5 rounded-md bg-muted/50 flex-shrink-0', config.color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground truncate block group-hover:text-primary transition-colors">
            {resource.title}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {resource.resource_type === 'link' ? t('syllabus.resources.externalLink') : formatFileSize(resource.file_size)}
          </span>
        </div>
        {isLink ? (
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        ) : (
          <Download className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card/50 overflow-hidden',
        isVideo && videoRevealed && 'w-max max-w-full mx-auto',
      )}
    >
      {showPreview && (
        <div className={cn(isVideo && 'relative')}>
          {isVideo && videoRevealed && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-2 end-2 z-10 h-8 w-8 rounded-full border border-border bg-background/95 shadow-sm hover:bg-muted"
              onClick={() => setVideoRevealed(false)}
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <ResourcePreview resource={resource} />
        </div>
      )}
      <div className={cn('flex items-center gap-3 px-4 py-3', isRTL && 'flex-row-reverse')}>
        <div className={cn('p-2 rounded-lg bg-muted/50', config.color)}>
          {isVideo && !videoRevealed ? (
            <Play className="h-4 w-4" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>
        <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
          <h4 className="text-sm font-medium text-foreground truncate">{resource.title}</h4>
          <p className="text-[11px] text-muted-foreground truncate">
            {isLink ? url : formatFileSize(resource.file_size)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpen}
          aria-expanded={isVideo ? videoRevealed : undefined}
          className="rounded-full gap-1.5 h-8 text-xs flex-shrink-0"
        >
          {useOpenAction ? (
            <>
              <ExternalLink className="h-3 w-3" />{' '}
              {isVideo && videoRevealed
                ? t('syllabus.resources.openInNewTab')
                : t('syllabus.resources.open')}
            </>
          ) : (
            <>
              <Download className="h-3 w-3" /> {t('syllabus.resources.download')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export const ResourceViewer = ({ resources, isRTL = false, compact = false }: ResourceViewerProps) => {
  const { t } = useTranslation();

  if (resources.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className={cn(
        'text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1',
        isRTL && 'flex-row-reverse text-right'
      )}>
        <FileText className="h-3 w-3" /> {t('syllabus.resources.title')} ({resources.length})
      </h4>
      <div className={compact ? 'space-y-1' : 'space-y-3'}>
        {resources.map((resource) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            isRTL={isRTL}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
};
