# Student classroom detail

Student opens an enrolled classroom and lands on the About (overview) tab.

## Sub-features

- `open-classroom` — Navigate via sandbox `classroomId` deep link
- `detail-shell` — URL matches `/student/classroom/:id`; classroom name visible on overview

## How to get to it (user POV)

- From `/student/dashboard`, click a classroom card
- Or navigate directly to `/student/classroom/<id>` (sandbox classroom after `verify:seed`)

## Driving it with Playwright

Preconditions:

- Student auth state exists
- `npm run verify:seed` completed (sandbox `classroomId` in `fixtures/sandbox.json`)
- Student enrolled in sandbox classroom

Steps:

1. `npm run verify:feature -- --id student-classroom-detail --run <run-id>`
2. **Observable result:** `finalUrl` contains `/student/classroom/`; screenshot shows classroom name heading on About tab

## Gotchas

- Student must be enrolled — run `verify:seed` or join via `student-join-class` first
- Curriculum tab only appears when syllabus is published; smoke test only asserts overview shell
- Sidebar uses menu buttons, not `role="tab"`
