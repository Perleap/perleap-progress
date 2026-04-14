import { cn } from '@/lib/utils';

/** Brand mark (multi-color); served from `public/perleap.svg` (same file as the favicon). */
export function PerleapLogo({ className, title }: { className?: string; title?: string }) {
  return (
    <img
      src="/perleap.svg"
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
