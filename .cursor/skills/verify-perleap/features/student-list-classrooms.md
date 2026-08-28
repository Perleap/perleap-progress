# Student list classrooms

## Sub-features

- Dashboard shows enrolled **Verify Sandbox** classroom.

## How to get to it (user POV)

- Sign in as student → `/student/dashboard` → **My Classes** lists **Verify Sandbox**.

## Driving it with Playwright

1. `npm run verify:login -- --role student`
2. `npm run verify:feature -- --id student-list-classrooms`

## Gotchas

- Requires sandbox seed and student enrollment.
