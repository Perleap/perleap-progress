# Step P4-12 — Landing auth hook + marketing i18n

**Date:** 2026-09-01

## What changed

- Extracted `useLandingAuthRedirect` hook; thinned `Landing.tsx`
- Added `product`, `solutions`, `pricing` i18n namespaces; expanded `contact` keys (en + he)
- Wired i18n into Product/Solutions/Pricing/ContactUs pages

## Live QA (local verify)

| Feature | Run | Result |
|---------|-----|--------|
| `marketing-pricing-load` | `p4-t12-gate-pricing` | PASS |
| `marketing-contact-load` | `p4-t12-gate-contact` | PASS |
| `marketing-landing-load` | `p4-t12-gate-landing` | PASS |

## Automated gates

- `npm run test:run` — 256/256
- `npm run check:i18n` — 0 missing
