import * as React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-20 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700', className)}>
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 blur-xl animate-pulse" />
        <div className="relative rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 p-8 shadow-lg backdrop-blur-sm border border-primary/20">
          <Icon className="h-16 w-16 text-primary animate-in zoom-in duration-500 delay-200" />
        </div>
      </div>
      <h3 className="text-2xl font-bold mb-3 text-center bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text animate-in fade-in duration-500 delay-300">{title}</h3>
      <p className="text-muted-foreground text-center max-w-md mb-8 text-base animate-in fade-in duration-500 delay-400">{description}</p>
      {action && (
        <Button 
          size="lg" 
          onClick={action.onClick} 
          className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 animate-in fade-in zoom-in duration-500 delay-500"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}


