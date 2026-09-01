# Step P4-14 — CI smoke marketing expansion

**Date:** 2026-09-01

## What changed

- Expanded `ci-smoke.json` from 6 → 8 features (added `marketing-landing-load`, `marketing-pricing-load`)

## Live QA (local verify)

| Suite | Run | Result |
|-------|-----|--------|
| `verify:ci-smoke` | `p4-t14-gate` | **8/8 PASS** |

## Automated gates

- `npm run test:run` — 256/256
