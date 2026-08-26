import { useAuthenticatedBlobUrl } from '@/hooks/useAuthenticatedBlobUrl';
import { SUBMISSION_FILES_BUCKET } from '@/utils/storageUrls';
import { Loader2 } from 'lucide-react';

export function SubmissionStoragePreview({
  storedUrl,
  type,
  name,
  content,
  zoomLevel = 1,
}: {
  storedUrl?: string;
  type?: string;
  name: string;
  content: string;
  zoomLevel?: number;
}) {
  const { blobUrl, isLoading } = useAuthenticatedBlobUrl(
    SUBMISSION_FILES_BUCKET,
    storedUrl,
    Boolean(storedUrl && type === 'image'),
  );

  if (type === 'image' && storedUrl) {
    if (isLoading) {
      return (
        <div className="flex min-h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (!blobUrl) return null;
    return (
      <div className="flex min-h-full items-center justify-center">
        <img
          src={blobUrl}
          alt={name}
          className="h-auto w-full object-contain transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
        />
      </div>
    );
  }

  return <pre className="whitespace-pre-wrap font-mono text-sm">{content}</pre>;
}
