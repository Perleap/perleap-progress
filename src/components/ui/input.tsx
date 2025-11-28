import * as React from 'react';

import { cn, detectTextDirection } from '@/lib/utils';

interface InputProps extends React.ComponentProps<'input'> {
  /** 
   * Enable auto-detection of text direction based on content.
   * Hebrew text → RTL, Latin text → LTR.
   * Set to false for fields that should always be LTR (e.g., email, password).
   */
  autoDirection?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, autoDirection = false, dir, onChange, ...props }, ref) => {
    const [textDir, setTextDir] = React.useState<'ltr' | 'rtl'>(dir as 'ltr' | 'rtl' || 'ltr');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (autoDirection) {
        const detectedDir = detectTextDirection(e.target.value);
        setTextDir(detectedDir);
      }
      onChange?.(e);
    };

    // Determine the final direction
    const finalDir = autoDirection ? textDir : dir;

    return (
      <input
        type={type}
        dir={finalDir}
        className={cn(
          'flex h-11 w-full rounded-2xl border border-input bg-input px-4 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
