import { useEffect, useRef, useCallback } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  fadeInUp,
  staggerFadeInUp,
  scrollFadeIn,
  scrollStaggerIn,
  pageEnter,
  cardHoverEnter,
  cardHoverLeave,
} from '@/lib/animations';

// Register plugins
gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Hook for page transition animation
 * Automatically animates the container on mount
 */
export function usePageTransition(dependencies: React.DependencyList = []) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (containerRef.current) {
        pageEnter(containerRef.current);
      }
    },
    { scope: containerRef, dependencies }
  );

  return containerRef;
}

/**
 * Hook for fade in animation on mount
 */
export function useFadeIn(delay = 0, dependencies: React.DependencyList = []) {
  const elementRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (elementRef.current) {
        fadeInUp(elementRef.current, delay);
      }
    },
    { scope: elementRef, dependencies }
  );

  return elementRef;
}

/**
 * Hook for stagger animation on children
 * Optimized to prevent forced reflows by using requestAnimationFrame
 * and only animating when dependencies actually change
 */
export function useStaggerAnimation(
  childSelector = ':scope > *',
  stagger = 0.1,
  dependencies: React.DependencyList = []
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDepsRef = useRef<string>(JSON.stringify(dependencies));

  useGSAP(
    () => {
      const currentDeps = JSON.stringify(dependencies);
      
      // Only animate if dependencies actually changed
      if (containerRef.current && currentDeps !== lastDepsRef.current) {
        // Cancel any pending animation
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        // Use requestAnimationFrame to batch DOM operations and avoid forced reflow
        animationFrameRef.current = requestAnimationFrame(() => {
          if (containerRef.current) {
            const children = containerRef.current.querySelectorAll(childSelector);
            if (children.length > 0) {
              // Reduced duration and simplified animation for better performance
              staggerFadeInUp(children, stagger, 0.3);
            }
          }
          lastDepsRef.current = currentDeps;
        });
      }
    },
    { scope: containerRef, dependencies }
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return containerRef;
}

/**
 * Hook for scroll-triggered animation
 */
export function useScrollAnimation(options: ScrollTrigger.Vars = {}) {
  const elementRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (elementRef.current) {
        scrollFadeIn(elementRef.current, options);
      }
    },
    { scope: elementRef }
  );

  return elementRef;
}

/**
 * Hook for scroll-triggered stagger animation on children
 */
export function useScrollStagger(
  childSelector = ':scope > *',
  options: ScrollTrigger.Vars = {}
) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (containerRef.current) {
        scrollStaggerIn(containerRef.current, childSelector, options);
      }
    },
    { scope: containerRef }
  );

  return containerRef;
}

/**
 * Hook for card hover animations
 */
export function useCardHover() {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (cardRef.current) {
      cardHoverEnter(cardRef.current);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (cardRef.current) {
      cardHoverLeave(cardRef.current);
    }
  }, []);

  return {
    ref: cardRef,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };
}

/**
 * Hook for animating a list of items when they change
 */
export function useAnimatedList<T>(
  items: T[],
  childSelector = ':scope > *',
  stagger = 0.05
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(items.length);

  useEffect(() => {
    if (containerRef.current && items.length > prevLengthRef.current) {
      // New items added, animate them
      const children = containerRef.current.querySelectorAll(childSelector);
      const newItems = Array.from(children).slice(prevLengthRef.current);

      if (newItems.length > 0) {
        gsap.fromTo(
          newItems,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.4, stagger, ease: 'power2.out' }
        );
      }
    }
    prevLengthRef.current = items.length;
  }, [items.length, childSelector, stagger]);

  return containerRef;
}

/**
 * Hook for button press animation
 */
export function useButtonPress() {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (buttonRef.current) {
      gsap.to(buttonRef.current, {
        scale: 0.95,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut',
      });
    }
  }, []);

  return {
    ref: buttonRef,
    onClick: handleClick,
  };
}

/**
 * Hook for pulse animation (notifications, badges)
 */
export function usePulse(active = true) {
  const elementRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (elementRef.current && active) {
      tweenRef.current = gsap.to(elementRef.current, {
        scale: 1.05,
        duration: 0.6,
        yoyo: true,
        repeat: -1,
        ease: 'power1.inOut',
      });
    }

    return () => {
      if (tweenRef.current) {
        tweenRef.current.kill();
      }
    };
  }, [active]);

  return elementRef;
}

/**
 * Hook for slide in from a direction
 */
export function useSlideIn(
  direction: 'up' | 'down' | 'left' | 'right' = 'up',
  delay = 0,
  dependencies: React.DependencyList = []
) {
  const elementRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (elementRef.current) {
        const fromVars: gsap.TweenVars = { opacity: 0 };
        const toVars: gsap.TweenVars = {
          opacity: 1,
          duration: 0.5,
          delay,
          ease: 'power2.out',
        };

        switch (direction) {
          case 'up':
            fromVars.y = 30;
            toVars.y = 0;
            break;
          case 'down':
            fromVars.y = -30;
            toVars.y = 0;
            break;
          case 'left':
            fromVars.x = 30;
            toVars.x = 0;
            break;
          case 'right':
            fromVars.x = -30;
            toVars.x = 0;
            break;
        }

        gsap.fromTo(elementRef.current, fromVars, toVars);
      }
    },
    { scope: elementRef, dependencies }
  );

  return elementRef;
}

export { gsap, ScrollTrigger };





