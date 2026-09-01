# Step P3-10 — Marketing pages light pass

**Date:** 2026-09-01

## What changed

- Added `src/components/marketing/` with `MarketingPageLayout`, `PricingPlanCard`, and `pricingPlans` data
- Refactored `Pricing.tsx` (~475→~70 lines) to map shared plan cards
- Applied `MarketingPageLayout` to Landing, Product, Solutions, AboutUs, Pricing
- Removed dead scaffold `src/pages/Index.tsx` (unused; `/` routes to `Landing`)
- Fixed pricing sales CTA: `href="#"` → `/contact`

## Route check

| Route | Page |
|-------|------|
| `/` | Landing |
| `/product` | Product |
| `/solutions` | Solutions |
| `/pricing` | Pricing |
| `/about` | AboutUs |
| `/contact` | ContactUs |

## Automated gates

- `npm run build` — pass
- `npm run test:run` — 256/256
