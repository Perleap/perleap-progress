import { AvatarImage } from '@/components/ui/avatar';
import { useAuthenticatedBlobUrl } from '@/hooks/useAuthenticatedBlobUrl';
import { inferAvatarBucket } from '@/utils/storageUrls';
import type { ComponentProps } from 'react';

type SecureAvatarImageProps = Omit<ComponentProps<typeof AvatarImage>, 'src'> & {
  src?: string | null;
  bucket?: string;
};

/** Keeps AvatarFallback hidden while the authenticated blob is still loading. */
const AVATAR_LOADING_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Avatar image backed by authenticated storage download (session-scoped blob URL). */
export function SecureAvatarImage({ src, bucket, alt, ...props }: SecureAvatarImageProps) {
  const trimmed = src?.trim();
  const resolvedBucket = bucket ?? inferAvatarBucket(trimmed);
  const isLocalPreview = trimmed?.startsWith('blob:') || trimmed?.startsWith('data:');
  const { blobUrl, isLoading } = useAuthenticatedBlobUrl(
    resolvedBucket,
    trimmed,
    Boolean(trimmed) && !isLocalPreview,
  );

  const displaySrc = isLocalPreview
    ? trimmed
    : blobUrl ?? (isLoading ? AVATAR_LOADING_PLACEHOLDER : null);
  if (!displaySrc) return null;

  return (
    <AvatarImage
      src={displaySrc}
      alt={alt}
      {...props}
      onLoad={(event) => {
        if (displaySrc === AVATAR_LOADING_PLACEHOLDER) return;
        props.onLoad?.(event);
      }}
    />
  );
}
