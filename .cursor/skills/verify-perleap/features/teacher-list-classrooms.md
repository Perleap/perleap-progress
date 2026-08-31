# Teacher list classrooms

Teacher dashboard shows the seeded **Verify Sandbox** classroom card.

## Sub-features

- `dashboard-list` — Classroom heading **Verify Sandbox** on `/teacher/dashboard`

## How to get to it (user POV)

- Sign in as teacher → `/teacher/dashboard`
- **Verify Sandbox** appears among classroom cards

## Driving it with Playwright

Preconditions:

- `npm run verify:login -- --role teacher`
- `npm run verify:seed` (teacher owns sandbox classroom)

Steps:

1. `npm run verify:feature -- --id teacher-list-classrooms --run <run-id>`
2. **Observable result:** Dashboard screenshot shows **Verify Sandbox** heading

## Gotchas

- Empty teacher dashboard blocks this — run seed or create a classroom first
- Distinct from `teacher-auth-dashboard` which accepts empty state
