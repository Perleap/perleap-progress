/**
 * Loading Spinner Component
 * GSAP-powered loading state component
 */

import gsap from 'gsap';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface LoadingSpinnerProps {
  text?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Display a GSAP-animated loading spinner with optional text
 */
export const LoadingSpinner = ({
  text = 'Loading...',
  className = '',
  size = 'md',
}: LoadingSpinnerProps) => {
  const spinnerRef = useRef<SVGSVGElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  const sizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  useEffect(() => {
    const spinner = spinnerRef.current;
    const text = textRef.current;

    if (spinner) {
      gsap.to(spinner, {
        rotation: 360,
        duration: 1,
        repeat: -1,
        ease: 'linear',
        transformOrigin: 'center center',
      });
    }

    if (text) {
      gsap.to(text, {
        opacity: 0.6,
        duration: 0.8,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      });
    }

    return () => {
      if (spinner) gsap.killTweensOf(spinner);
      if (text) gsap.killTweensOf(text);
    };
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <Loader2 ref={spinnerRef} className={`${sizeClasses[size]} text-primary mb-2`} />
      {text && (
        <p ref={textRef} className="text-muted-foreground">
          {text}
        </p>
      )}
    </div>
  );
};

/**
 * Full page loading spinner for page transitions
 */
export const PageLoadingSpinner = ({ text }: { text?: string }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoadingSpinner text={text} size="lg" />
    </div>
  );
};
