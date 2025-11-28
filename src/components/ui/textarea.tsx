import * as React from 'react';

import { cn, detectTextDirection } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 
   * Enable auto-detection of text direction based on content.
   * Hebrew text → RTL, Latin text → LTR.
   */
  autoDirection?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoDirection = false, dir, onChange, ...props }, ref) => {
    const [textDir, setTextDir] = React.useState<'ltr' | 'rtl'>(dir as 'ltr' | 'rtl' || 'ltr');

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoDirection) {
        const detectedDir = detectTextDirection(e.target.value);
        setTextDir(detectedDir);
      }
      onChange?.(e);
    };

    // Determine the final direction
    const finalDir = autoDirection ? textDir : dir;

    return (
      <textarea
        dir={finalDir}
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
