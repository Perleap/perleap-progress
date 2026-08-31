# Teacher planner load

Teacher opens the planner page and sees the calendar shell.

## Sub-features

- `planner-shell` — `/teacher/planner` loads
- `planner-heading` — **Planner** heading and schedule tagline

## How to get to it (user POV)

- Sign in as teacher → navigate to **Planner**
- Page shows **Planner** and **Manage your schedule and assignments**

## Driving it with Playwright

Preconditions:

- `npm run verify:login -- --role teacher`

Steps:

1. `npm run verify:feature -- --id teacher-planner-load --run <run-id>`
2. **Observable result:** Planner heading and tagline in screenshot

## Gotchas

- Smoke checks page shell only — does not create or drag calendar events
- Calendar data may be empty for fresh teacher accounts
