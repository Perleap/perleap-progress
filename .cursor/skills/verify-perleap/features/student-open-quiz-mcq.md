# Student open quiz MCQ

Student opens the sandbox MCQ quiz and sees the first question.

## Sub-features

- `open-mcq` — Deep link to sandbox MCQ assignment
- `first-question` — **What is 2 + 2?** visible

## How to get to it (user POV)

- From curriculum, open the seeded MCQ assignment
- Or navigate to `/student/assignment/<mcqAssignmentId>`

## Driving it with Playwright

Preconditions:

- Student auth + sandbox `mcqAssignmentId` from `verify:seed`

Steps:

1. `npm run verify:feature -- --id student-open-quiz-mcq --run <run-id>`
2. **Observable result:** First MCQ question text visible

## Gotchas

- Seed-specific question copy — update proof if sandbox content changes
- Does not submit answers; smoke only asserts render
