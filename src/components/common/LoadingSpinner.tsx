/**
 * Loading Spinner Component
 * Reusable loading state component
 */

import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  text?: string;
  className?: string;
}

/**
 * Display a loading spinner with optional text
 */
export const LoadingSpinner = ({ text = 'Loading...', className = '' }: LoadingSpinnerProps) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
};
