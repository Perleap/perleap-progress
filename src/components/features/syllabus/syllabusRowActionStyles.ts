import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const syllabusRowActionClass = cn(
  buttonVariants({ variant: 'ghost', size: 'icon' }),
  'h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors'
);

export const syllabusRowDestructiveActionClass = cn(
  buttonVariants({ variant: 'ghost', size: 'icon' }),
  'h-8 w-8 shrink-0 rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors'
);

export const syllabusRowDragHandleClass =
  'touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md transition-colors p-1 shrink-0';
