# Student assignment detail

Student opens the refactored assignment detail page for the sandbox chat assignment.

## Sub-features

- `open-assignment` — Deep link to `/student/assignment/:id` (sandbox chat assignment)
- `detail-shell` — Back control, assignment title `h1`, chat input ready

## How to get to it (user POV)

- From classroom **Curriculum** or dashboard assignments, open **Verify Chat Smoke**
- Or navigate directly to `/student/assignment/<chatAssignmentId>` after `verify:seed`

## Driving it with Playwright

Preconditions:

- Student auth state exists
- `npm run verify:seed` completed (`chatAssignmentId` in `fixtures/sandbox.json`)

Steps:

1. `npm run verify:feature -- --id student-assignment-detail --run <run-id>`
2. **Observable result:** `finalUrl` contains `/student/assignment/`; screenshot shows title heading and chat input

## Gotchas

- Intro wizard may appear on first visit — driver dismisses via `dismissAssignmentIntro`
- If a prior attempt is completed, use `freshAttempt` path in other features; this smoke only asserts the detail shell loads
- Pair with `student-complete-chat` after refactor tracks to prove submission routing still works end-to-end
