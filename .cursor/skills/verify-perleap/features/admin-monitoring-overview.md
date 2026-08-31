# Admin monitoring overview

Admin opens the monitoring dashboard and sees the at-a-glance summary.

## Sub-features

- `monitoring-shell` — `/admin/monitoring` loads
- `overview-heading` — **Monitoring** and **At a glance** sections

## How to get to it (user POV)

- Sign in as admin → **Monitoring** (or `/admin/monitoring`)
- Overview shows **At a glance** metrics section

## Driving it with Playwright

Preconditions:

- `npm run verify:login -- --role admin`

Steps:

1. `npm run verify:feature -- --id admin-monitoring-overview --run <run-id>`
2. **Observable result:** **Monitoring** and **At a glance** headings visible

## Gotchas

- Admin-only route — use admin credentials from `.env.verify`
- Metrics may be sparse in dev; smoke asserts page structure only
