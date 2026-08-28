# Student activity page

Student opens a published curriculum activity from the sandbox classroom.

## Sub-features

- `open-activity` — Deep link to `/student/classroom/:id/activity/:resourceId`
- `activity-shell` — Activity title heading and Back control visible

## How to get to it (user POV)

- From classroom **Curriculum**, click an activity in the module flow
- Or navigate directly to `/student/classroom/<id>/activity/<resourceId>` after `verify:seed`

## Driving it with Playwright

Preconditions:

- Student auth state exists
- `npm run verify:seed` completed (`activityResourceId` in `fixtures/sandbox.json`)

Steps:

1. `npm run verify:feature -- --id student-activity-page --run <run-id>`
2. **Observable result:** `finalUrl` contains `/activity/`; screenshot shows activity title `h1`

## Gotchas

- Requires published syllabus + activity from seed (added in verify seed v2)
- Sequential lock may block if earlier flow steps are incomplete — seed puts a single text activity first in module flow
