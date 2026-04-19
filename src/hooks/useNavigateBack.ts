import { useCallback } from 'react';
import { useNavigate, type NavigateFunction, type To } from 'react-router-dom';

/**
 * True when the session history likely has a prior in-app entry we can pop.
 * React Router's browser history may set `idx` on state; otherwise use length heuristic.
 */
export function canGoBackInHistory(): boolean {
  const state = window.history.state as { idx?: number } | null;
  if (state && typeof state.idx === 'number') {
    return state.idx > 0;
  }
  return window.history.length > 1;
}

export function navigateBackOrTo(navigate: NavigateFunction, fallbackTo: To): void {
  if (canGoBackInHistory()) {
    navigate(-1);
  } else {
    navigate(fallbackTo);
  }
}

/**
 * Prefer one browser history step back; otherwise navigate to `fallbackTo`
 * (e.g. direct URL open or first entry in tab).
 */
export function useNavigateBack(fallbackTo: To) {
  const navigate = useNavigate();
  return useCallback(() => {
    navigateBackOrTo(navigate, fallbackTo);
  }, [navigate, fallbackTo]);
}
