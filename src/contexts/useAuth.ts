/** Re-export keeps `@/contexts/useAuth` imports; implementation lives in `AuthContext.tsx` with `AuthContext` (single module, avoids HMR duplicate-context bugs). */
export { useAuth } from './AuthContext';
