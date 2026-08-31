# Teacher classroom submissions tab

Teacher opens the Submissions section on the sandbox classroom.

## Sub-features

- `submissions-tab` — **Submissions** section button
- `submissions-shell` — Heading **Student Submissions** visible

## How to get to it (user POV)

- Sign in → open **Verify Sandbox** classroom
- Click **Submissions**
- See **Student Submissions** panel

## Driving it with Playwright

Preconditions:

- Teacher auth + sandbox classroom from seed

Steps:

1. `npm run verify:feature -- --id teacher-classroom-submissions-tab --run <run-id>`
2. **Observable result:** **Student Submissions** heading visible

## Gotchas

- Tab content may be empty before `student-complete-chat` — shell proof only
- Migrated to `features/submission/` in R6 — smoke checks UI mount
