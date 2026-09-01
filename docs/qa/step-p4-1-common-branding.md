# Step P4-1 — Common branding + dead root cleanup

**Date:** 2026-09-01

## What changed

- Deleted unused root components: `NavLink.tsx`, `StudentProfileModal.tsx`, `DashboardHeader.tsx` (duplicate of `layouts/DashboardHeader.tsx`)
- Moved to `src/components/common/`:
  - `PerleapLogo.tsx`
  - `ThemeToggle.tsx`
  - `LanguageSwitcher.tsx`
- Updated barrel [`src/components/common/index.ts`](../src/components/common/index.ts)
- Updated imports in auth, layouts, onboarding, landing, NotFound

## Live QA (local verify)

| Feature | Run | Result |
|---------|-----|--------|
| `auth-page-load` | `p4-t1-gate` | PASS |

## Automated gates

- `npm run test:run` — 256/256
