import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// ==========================================
// Basic Animation Utilities
// ==========================================

/**
 * Fade in an element from below
 */
export const fadeInUp = (element: Element | null, delay = 0, duration = 0.5) => {
  if (!element) return;
  return gsap.fromTo(
    element,
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration, delay, ease: 'power2.out' }
  );
};

/**
 * Fade in an element from above
 */
export const fadeInDown = (element: Element | null, delay = 0, duration = 0.5) => {
  if (!element) return;
  return gsap.fromTo(
    element,
    { opacity: 0, y: -20 },
    { opacity: 1, y: 0, duration, delay, ease: 'power2.out' }
  );
};

/**
 * Fade in from left
 */
export const fadeInLeft = (element: Element | null, delay = 0, duration = 0.5) => {
  if (!element) return;
  return gsap.fromTo(
    element,
    { opacity: 0, x: -30 },
    { opacity: 1, x: 0, duration, delay, ease: 'power2.out' }
  );
};

/**
 * Fade in from right
 */
export const fadeInRight = (element: Element | null, delay = 0, duration = 0.5) => {
  if (!element) return;
  return gsap.fromTo(
    element,
    { opacity: 0, x: 30 },
    { opacity: 1, x: 0, duration, delay, ease: 'power2.out' }
  );
};

/**
 * Simple fade in
 */
export const fadeIn = (element: Element | null, delay = 0, duration = 0.4) => {
  if (!element) return;
  return gsap.fromTo(
    element,
    { opacity: 0 },
    { opacity: 1, duration, delay, ease: 'power2.out' }
  );
};

/**
 * Scale in from center
 */
export const scaleIn = (element: Element | null, delay = 0, duration = 0.4) => {
  if (!element) return;
  return gsap.fromTo(
    element,
    { opacity: 0, scale: 0.9 },
    { opacity: 1, scale: 1, duration, delay, ease: 'back.out(1.7)' }
  );
};

// ==========================================
// Stagger Animations
// ==========================================

/**
 * Stagger fade in children elements
 */
export const staggerFadeInUp = (
  elements: Element[] | NodeListOf<Element> | null,
  stagger = 0.1,
  duration = 0.5
) => {
  if (!elements || (elements as Element[]).length === 0) return;
  return gsap.fromTo(
    elements,
    { opacity: 0, y: 30 },
    { opacity: 1, y: 0, duration, stagger, ease: 'power3.out' }
  );
};

/**
 * Stagger scale in children elements
 */
export const staggerScaleIn = (
  elements: Element[] | NodeListOf<Element> | null,
  stagger = 0.08,
  duration = 0.4
) => {
  if (!elements || (elements as Element[]).length === 0) return;
  return gsap.fromTo(
    elements,
    { opacity: 0, scale: 0.85 },
    { opacity: 1, scale: 1, duration, stagger, ease: 'back.out(1.4)' }
  );
};

// ==========================================
// Scroll Trigger Animations
// ==========================================

/**
 * Create a scroll-triggered fade in animation
 */
export const scrollFadeIn = (element: Element | null, options: ScrollTrigger.Vars = {}) => {
  if (!element) return;
  return gsap.fromTo(
    element,
    { opacity: 0, y: 40 },
    {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: element,
        start: 'top 85%',
        end: 'bottom 20%',
        toggleActions: 'play none none reverse',
        ...options,
      },
    }
  );
};

/**
 * Create a scroll-triggered stagger animation
 */
export const scrollStaggerIn = (
  container: Element | null,
  childSelector: string,
  options: ScrollTrigger.Vars = {}
) => {
  if (!container) return;
  const children = container.querySelectorAll(childSelector);
  if (children.length === 0) return;

  return gsap.fromTo(
    children,
    { opacity: 0, y: 30 },
    {
      opacity: 1,
      y: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: container,
        start: 'top 80%',
        toggleActions: 'play none none reverse',
        ...options,
      },
    }
  );
};

// ==========================================
// Micro-interactions
// ==========================================

/**
 * Button press effect
 */
export const buttonPress = (element: Element | null) => {
  if (!element) return;
  return gsap.to(element, {
    scale: 0.95,
    duration: 0.1,
    yoyo: true,
    repeat: 1,
    ease: 'power2.inOut',
  });
};

/**
 * Hover scale effect
 */
export const hoverScale = (element: Element | null, scale = 1.05) => {
  if (!element) return;
  return gsap.to(element, {
    scale,
    duration: 0.2,
    ease: 'power2.out',
  });
};

/**
 * Reset scale
 */
export const resetScale = (element: Element | null) => {
  if (!element) return;
  return gsap.to(element, {
    scale: 1,
    duration: 0.2,
    ease: 'power2.out',
  });
};

/**
 * Pulse animation (for notifications, badges, etc.)
 */
export const pulse = (element: Element | null, repeat = -1) => {
  if (!element) return;
  return gsap.to(element, {
    scale: 1.05,
    duration: 0.6,
    yoyo: true,
    repeat,
    ease: 'power1.inOut',
  });
};

/**
 * Shake animation (for errors)
 */
export const shake = (element: Element | null) => {
  if (!element) return;
  return gsap.to(element, {
    x: [-10, 10, -8, 8, -4, 4, 0],
    duration: 0.5,
    ease: 'power2.out',
  });
};

// ==========================================
// Page Transitions
// ==========================================

/**
 * Page enter animation
 */
export const pageEnter = (container: Element | null) => {
  if (!container) return;
  return gsap.fromTo(
    container,
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
  );
};

/**
 * Page exit animation
 */
export const pageExit = (container: Element | null) => {
  if (!container) return;
  return gsap.to(container, {
    opacity: 0,
    y: -10,
    duration: 0.3,
    ease: 'power2.in',
  });
};

// ==========================================
// Card Animations
// ==========================================

/**
 * Card hover enter
 */
export const cardHoverEnter = (element: Element | null) => {
  if (!element) return;
  return gsap.to(element, {
    y: -4,
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.12)',
    duration: 0.3,
    ease: 'power2.out',
  });
};

/**
 * Card hover leave
 */
export const cardHoverLeave = (element: Element | null) => {
  if (!element) return;
  return gsap.to(element, {
    y: 0,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    duration: 0.3,
    ease: 'power2.out',
  });
};

// Export GSAP and ScrollTrigger for direct use
export { gsap, ScrollTrigger };





