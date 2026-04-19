import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const shellVariants = cva('rounded-xl border transition-colors', {
  variants: {
    variant: {
      embedded: 'border-border/70 bg-muted/15 shadow-none',
      reading: 'border-border/50 bg-card/95 shadow-sm',
      compact: 'border-0 bg-transparent p-0 shadow-none',
    },
  },
  defaultVariants: { variant: 'embedded' },
});

export type ContentBlockShellVariant = NonNullable<VariantProps<typeof shellVariants>['variant']>;

export function ContentBlockShell({
  className,
  variant = 'embedded',
  children,
}: {
  className?: string;
  variant?: ContentBlockShellVariant;
  children: ReactNode;
}) {
  return <div className={cn(shellVariants({ variant }), className)}>{children}</div>;
}
