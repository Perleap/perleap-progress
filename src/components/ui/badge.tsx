import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-4xl border border-transparent font-medium transition-colors focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 whitespace-nowrap shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'bg-destructive/10 hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 text-destructive dark:bg-destructive/20',
        outline: 'border-border text-foreground hover:bg-muted hover:text-muted-foreground',
        success: 'bg-success/10 hover:bg-success/20 focus-visible:ring-success/20 dark:focus-visible:ring-success/40 text-success dark:bg-success/20',
        warning: 'bg-warning/10 hover:bg-warning/20 focus-visible:ring-warning/20 dark:focus-visible:ring-warning/40 text-warning dark:bg-warning/20',
        info: 'bg-info/10 hover:bg-info/20 focus-visible:ring-info/20 dark:focus-visible:ring-info/40 text-info dark:bg-info/20',
        'muted-success': 'bg-success/10 text-success',
        'muted-warning': 'bg-warning/10 text-warning',
        'muted-info': 'bg-info/10 text-info',
        'muted-destructive': 'bg-destructive/10 text-destructive',
        'muted-primary': 'bg-primary/10 text-primary',
      },
      size: {
        sm: 'px-1.5 py-0 text-[10px] h-4',
        default: 'px-2 py-0.5 text-xs h-5',
        lg: 'px-3 py-1 text-sm h-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
