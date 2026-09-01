# Marketing pricing load

Anonymous visitor opens `/pricing` and sees plan cards plus the sales CTA linking to `/contact`.

## Sub-features

- `pricing-heading` — **Choose Your Plan** heading
- `plan-cards` — **Beginner** plan visible
- `sales-cta` — **Contact our sales team** link

## Driving it with Playwright

1. `npm run verify:feature -- --id marketing-pricing-load --run <run-id>`
2. **Observable result:** plan grid and sales CTA visible
