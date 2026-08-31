# Step S5-4 — AuthContext finish

**Date:** 2026-08-31

## Changes

- Extracted internal hooks under `src/contexts/auth/` (imported only by `AuthContext.tsx`):
  - `useAuthProfileQuery` — TanStack profile query
  - `useAuthSessionEffects` — session bootstrap + `onAuthStateChange`
  - `useSessionHealthMonitor` — expiry warnings
- Trimmed routine `console.log`; kept `console.error` / `console.warn` for failures
- Optional verbose logs: `VITE_DEBUG_AUTH=1` in dev (see `authDebug.ts`)

## Automated gate

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run test:run
```

## Manual QA

| # | Action | Pass if |
|---|--------|---------|
| 1 | Sign in as student | Dashboard loads; no console errors |
| 2 | Refresh (F5) | Still authenticated |
| 3 | Sign out → sign in as teacher | Teacher dashboard loads |
| 4 | Open `/teacher/settings` | Profile form loads |
| 5 | Sign out | Clean logout |

## Verify-perleap smoke

```bash
npm run verify:launch
npm run verify:feature -- --id auth-page-load --run s5-4-auth
npm run verify:login -- --role student
npm run verify:feature -- --id student-auth-dashboard --run s5-4-student
npm run verify:login -- --role teacher
npm run verify:feature -- --id teacher-auth-dashboard --run s5-4-teacher
npm run verify:cleanup
```
