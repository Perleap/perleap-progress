# Student view assignment list

Student opens the sandbox chat assignment and sees its title (assignment entry from curriculum/deep link).

## Sub-features

- `open-assignment` — Deep link `/student/assignment/:chatAssignmentId`
- `assignment-title` — Heading **Verify Chat Smoke** visible

## How to get to it (user POV)

- From classroom **Curriculum**, open **Verify Chat Smoke**
- Or navigate directly after `verify:seed`

## Driving it with Playwright

Preconditions:

- Student auth + sandbox `chatAssignmentId` in `fixtures/sandbox.json`

Steps:

1. `npm run verify:feature -- --id student-view-assignment-list --run <run-id>`
2. **Observable result:** Assignment title **Verify Chat Smoke** in screenshot

## Gotchas

- Requires `verify:seed` — missing `chatAssignmentId` fails fast
- Does not assert chat input; use `student-assignment-detail` for full shell proof
