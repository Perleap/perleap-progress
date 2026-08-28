# Teacher classroom overview

Teacher opens a classroom from the dashboard (or deep link) and lands on classroom detail.

## Sub-features

- `open-classroom` — Navigate from dashboard card or `VERIFY_TEACHER_CLASSROOM_ID`
- `detail-shell` — URL matches `/teacher/classroom/:id`

## How to get to it (user POV)

- From `/teacher/dashboard`, click a classroom card
- Or navigate directly to `/teacher/classroom/<id>`

## Driving it with Playwright

Preconditions:

- Teacher auth state exists
- Teacher account has at least one classroom **or** `VERIFY_TEACHER_CLASSROOM_ID` is set

Steps:

1. `npm run verify:feature -- --id teacher-classroom-overview --run <run-id>`
2. **Observable result:** `finalUrl` contains `/teacher/classroom/`; screenshot shows classroom detail UI

## Gotchas

- Empty teacher dashboard blocks this feature — create a classroom or set `VERIFY_TEACHER_CLASSROOM_ID`
- Default view mode is grid; classroom cards use `cursor-pointer` with `h3` title
- AI-heavy tabs (analytics, live session) are not part of this smoke proof
