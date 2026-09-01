# Step P4-10 — Landing sections merge

**Date:** 2026-09-01

## What changed

- Moved `src/components/landing/*` → `src/components/marketing/sections/`
- Added `LandingPageContent` composing Hero, mission scroll, FlowChart, Features, Customers
- Thinned `Landing.tsx` to auth redirect logic + `MarketingPageLayout` + `LandingPageContent`
- Removed empty `landing/` folder

## Live QA (local verify)

| Feature | Run | Result |
|---------|-----|--------|
| `marketing-landing-load` | `p4-t10-gate` | PASS |

## Automated gates

- `npm run test:run` — 256/256
