/**
 * GSAP-powered Skeleton Loading Component
 * Replaces animate-pulse with GSAP animation for smoother loading states
 */

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { cn } from '@/lib/utils';

interface GsapSkeletonProps {
  className?: string;
  variant?: 'default' | 'card' | 'text' | 'avatar' | 'button';
}

/**
 * GSAP-animated skeleton loader
 */
export function GsapSkeleton({ className, variant = 'default' }: GsapSkeletonProps) {
  const skeletonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (skeletonRef.current) {
      // GSAP pulse animation - smoother than CSS
      gsap.to(skeletonRef.current, {
        opacity: 0.5,
        duration: 1,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      });
    }

    return () => {
      if (skeletonRef.current) {
        gsap.killTweensOf(skeletonRef.current);
      }
    };
  }, []);

  const variantClasses = {
    default: '',
    card: 'h-48 rounded-xl',
    text: 'h-4 rounded',
    avatar: 'h-12 w-12 rounded-full',
    button: 'h-10 w-24 rounded-lg',
  };

  return (
    <div
      ref={skeletonRef}
      className={cn(
        'bg-muted',
        variantClasses[variant],
        className
      )}
    />
  );
}

/**
 * Skeleton card for dashboard loading states
 */
export function SkeletonCard({ className }: { className?: string }) {
  return <GsapSkeleton variant="card" className={className} />;
}

/**
 * Multiple skeleton cards for grid layouts
 */
export function SkeletonCardGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid sm:grid-cols-2 gap-6', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton row for list loading states
 */
export function SkeletonRow({ className }: { className?: string }) {
  return <GsapSkeleton className={cn('h-24 rounded-xl', className)} />;
}

/**
 * Multiple skeleton rows for list layouts
 */
export function SkeletonRowList({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}




