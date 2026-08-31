# Teacher classroom students tab

Teacher opens the Students section on the sandbox classroom.

## Sub-features

- `students-tab` — **Students** section button
- `enrolled-list` — Heading **Enrolled Students** visible

## How to get to it (user POV)

- Sign in → open **Verify Sandbox** classroom
- Click **Students** tab/section
- See **Enrolled Students** list

## Driving it with Playwright

Preconditions:

- Teacher auth + sandbox `classroomId` from `verify:seed`

Steps:

1. `npm run verify:feature -- --id teacher-classroom-students-tab --run <run-id>`
2. **Observable result:** **Enrolled Students** heading in screenshot

## Gotchas

- Deep links to `/teacher/classroom/:id` then clicks section by exact label
- Enrollment list depends on seed student join state
