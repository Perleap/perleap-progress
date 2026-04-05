import { cn } from '@/lib/utils';
import perleapLogoUrl from '@/assets/perleap.svg?url';

/** Brand mark (multi-color); bundled so it survives SPA deploys without relying on `public/`. */
export function PerleapLogo({ className, title }: { className?: string; title?: string }) {
  return (
    <img
      src={perleapLogoUrl}
      alt={title ?? ''}
      className={cn(
        'shrink-0 aspect-square rounded-full object-cover object-center',
        className
      )}
      aria-hidden={title ? undefined : true}
      loading="eager"
      decoding="async"
    />
  );
}
