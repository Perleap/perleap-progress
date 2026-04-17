import { cn } from '@/lib/utils';

const LOGO_SRC = {
  svg: '/perleap.svg',
  png: '/perleap_logo.png',
} as const;

export type PerleapLogoVariant = keyof typeof LOGO_SRC;

type PerleapLogoProps = {
  className?: string;
  title?: string;
  /** `svg` matches the favicon (crisp at any size). `png` uses the raster brand asset. */
  variant?: PerleapLogoVariant;
};

/** Brand mark; SVG is default (same file as the favicon). */
export function PerleapLogo({ className, title, variant = 'svg' }: PerleapLogoProps) {
  return (
    <img
      src={LOGO_SRC[variant]}
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
