/**
 * Loading Spinner Component
 * GSAP-powered loading state component
 */

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import gsap from 'gsap';

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
  size = 'md'
}: LoadingSpinnerProps) => {
  const spinnerRef = useRef<SVGSVGElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  const sizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  useEffect(() => {
    if (spinnerRef.current) {
      // GSAP spin animation
      gsap.to(spinnerRef.current, {
        rotation: 360,
        duration: 1,
        repeat: -1,
        ease: 'linear',
        transformOrigin: 'center center',
      });
    }

    if (textRef.current) {
      // Subtle pulse on text
      gsap.to(textRef.current, {
        opacity: 0.6,
        duration: 0.8,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      });
    }

    return () => {
      if (spinnerRef.current) {
        gsap.killTweensOf(spinnerRef.current);
      }
      if (textRef.current) {
        gsap.killTweensOf(textRef.current);
      }
    };
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <Loader2 ref={spinnerRef} className={`${sizeClasses[size]} text-primary mb-2`} />
      {text && <p ref={textRef} className="text-muted-foreground">{text}</p>}
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
