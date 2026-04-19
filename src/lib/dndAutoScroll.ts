import type { AutoScrollOptions } from '@dnd-kit/core';

/**
 * Pointer autoscroll inside overflow regions (dialogs, sheets), without scrolling
 * the document root (avoids “infinite” page motion).
 *
 * `layoutShiftCompensation: false` — when lesson content height shifts during drag
 * (rich text / transforms), core’s compensation `scrollBy` was feeding a loop with
 * autoscroll: `scrollHeight` kept growing in logs while `scrollTop` chased it.
 */
export const boundedPointerAutoScroll: AutoScrollOptions = {
  acceleration: 6,
  interval: 8,
  threshold: { x: 0.2, y: 0.22 },
  layoutShiftCompensation: false,
  canScroll: (element) => {
    if (element === document.documentElement || element === document.body) return false;
    const root = document.scrollingElement;
    if (root && element === root) return false;
    return true;
  },
};
