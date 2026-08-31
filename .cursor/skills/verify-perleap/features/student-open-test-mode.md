# Student open test mode

Student opens the sandbox test-mode assignment and sees the first question.

## Sub-features

- `open-test` — Deep link to sandbox test assignment
- `first-question` — **What is the capital of France?** visible

## How to get to it (user POV)

- From curriculum, open the seeded test assignment
- Or navigate to `/student/assignment/<testAssignmentId>`

## Driving it with Playwright

Preconditions:

- Student auth + sandbox `testAssignmentId` from `verify:seed`

Steps:

1. `npm run verify:feature -- --id student-open-test-mode --run <run-id>`
2. **Observable result:** First test question visible

## Gotchas

- Test mode may enforce timer/lock UI — smoke only checks first question render
- Seed-specific question copy
