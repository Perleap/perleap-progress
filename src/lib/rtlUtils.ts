/**
 * RTL Utility Functions
 * Helper functions for handling RTL (Right-to-Left) layouts
 */

/**
 * Returns the appropriate class based on current direction
 * @param ltrClass - Class to use for LTR layout
 * @param rtlClass - Class to use for RTL layout  
 * @param isRTL - Whether current direction is RTL
 * @returns The appropriate class string
 */
export const rtlClass = (ltrClass: string, rtlClass: string, isRTL: boolean): string => {
  return isRTL ? rtlClass : ltrClass;
};

/**
 * Returns margin/padding classes that are direction-aware
 * Converts left/right to start/end equivalents
 * @param className - Original className with l/r directions
 * @returns Direction-aware className
 */
export const directionAware = (className: string): string => {
  return className
    .replace(/\bml-/g, 'ms-')
    .replace(/\bmr-/g, 'me-')
    .replace(/\bpl-/g, 'ps-')
    .replace(/\bpr-/g, 'pe-')
    .replace(/\bleft-/g, 'start-')
    .replace(/\bright-/g, 'end-');
};

/**
 * Flips alignment for RTL
 * @param alignment - 'left', 'right', or 'center'
 * @param isRTL - Whether current direction is RTL
 * @returns Flipped alignment for RTL, original for LTR
 */
export const flipAlignment = (
  alignment: 'left' | 'right' | 'center',
  isRTL: boolean
): 'left' | 'right' | 'center' => {
  if (!isRTL || alignment === 'center') return alignment;
  return alignment === 'left' ? 'right' : 'left';
};

/**
 * Returns flex direction class that works with RTL
 * @param direction - Original flex direction
 * @param isRTL - Whether current direction is RTL
 * @returns RTL-aware flex direction
 */
export const rtlFlexDirection = (
  direction: 'row' | 'row-reverse' | 'col' | 'col-reverse',
  isRTL: boolean
): string => {
  if (!isRTL) return `flex-${direction}`;
  
  if (direction === 'row') return 'flex-row-reverse';
  if (direction === 'row-reverse') return 'flex-row';
  
  return `flex-${direction}`;
};

/**
 * Combines multiple class names, handling RTL-aware utilities
 * @param classes - Array of class names or conditional classes
 * @param isRTL - Whether current direction is RTL
 * @returns Combined className string
 */
export const cn = (...classes: (string | boolean | undefined)[]): string => {
  return classes.filter(Boolean).join(' ');
};

