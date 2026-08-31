/**
 * GSAP-powered Skeleton Loading Component
 * Replaces animate-pulse with GSAP animation for smoother loading states
 */

import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface GsapSkeletonProps {
  className?: string;
  variant?: 'default' | 'card' | 'text' | 'avatar' | 'button';
}

/**
 * GSAP-animated skeleton loader
 */
export const GsapSkeleton = ({ className, variant = 'default' }: GsapSkeletonProps) => {
  const skeletonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const skeleton = skeletonRef.current;

    if (skeleton) {
      gsap.to(skeleton, {
        opacity: 0.5,
        duration: 1,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      });
    }

    return () => {
      if (skeleton) gsap.killTweensOf(skeleton);
    };
  }, []);

  const variantClasses = {
    default: '',
    card: 'h-48 rounded-xl',
    text: 'h-4 rounded',
    avatar: 'h-12 w-12 rounded-full',
    button: 'h-10 w-24 rounded-lg',
  };

  return <div ref={skeletonRef} className={cn('bg-muted', variantClasses[variant], className)} />;
};

/**
 * Skeleton card for dashboard loading states
 */
export const SkeletonCard = ({ className }: { className?: string }) => {
  return <GsapSkeleton variant="card" className={className} />;
};

/**
 * Multiple skeleton cards for grid layouts
 */
export const SkeletonCardGrid = ({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) => {
  return (
    <div className={cn('grid sm:grid-cols-2 gap-6', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};

/**
 * Skeleton row for list loading states
 */
export const SkeletonRow = ({ className }: { className?: string }) => {
  return <GsapSkeleton className={cn('h-24 rounded-xl', className)} />;
};

/**
 * Multiple skeleton rows for list layouts
 */
export const SkeletonRowList = ({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
};
