# Step P4-8 — Marketing verify infrastructure

**Date:** 2026-09-01

## What changed

- Registered 4 anonymous verify features in `features/registry.mjs`:
  - `marketing-landing-load`
  - `marketing-pricing-load`
  - `marketing-contact-load`
  - `marketing-nav-links`
- Added `features/suites/marketing-smoke.json` and `npm run verify:marketing-smoke`
- Added feature `.md` docs for each marketing feature

## Live QA (local verify)

| Feature / suite | Run | Result |
|-----------------|-----|--------|
| `verify:marketing-smoke` (4 features) | `p4-t8-gate` | PASS |

## Automated gates

- `npm run test:run` — 256/256
