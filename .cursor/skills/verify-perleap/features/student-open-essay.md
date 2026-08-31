# Student open essay

Student opens the sandbox essay assignment and sees the essay editor.

## Sub-features

- `open-essay` — Deep link to sandbox essay assignment
- `essay-editor` — Placeholder **Write your essay here…** visible

## How to get to it (user POV)

- From curriculum, open the seeded essay assignment
- Or navigate to `/student/assignment/<essayAssignmentId>`

## Driving it with Playwright

Preconditions:

- Student auth + sandbox `essayAssignmentId` from `verify:seed`

Steps:

1. `npm run verify:feature -- --id student-open-essay --run <run-id>`
2. **Observable result:** Essay editor placeholder visible in screenshot

## Gotchas

- Requires seed v2 essay fixture — re-run `verify:seed` if missing
- Intro wizard dismissed automatically like other assignment types
