# Marketing landing load

Anonymous visitor opens `/` and sees the landing hero (i18n `landing.hero.title1/title2`).

## Sub-features

- `landing-hero` — **Agentic AI for** + **Education** visible

## Driving it with Playwright

Preconditions:

- `npm run verify:launch` and `npm run verify:doctor` pass
- No auth storage (role: anonymous)

Steps:

1. `npm run verify:feature -- --id marketing-landing-load --run <run-id>`
2. **Observable result:** hero titles visible; screenshot shows landing page

## Gotchas

- Logged-in users redirect away from `/` — use anonymous context only
