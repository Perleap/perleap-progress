# Student classroom curriculum

Student opens the Curriculum tab on the sandbox classroom (or sees About when no syllabus).

## Sub-features

- `curriculum-tab` — **Curriculum** button and heading
- `curriculum-list` — Module/activity browse copy visible
- `about-fallback` — **About** tab when syllabus unpublished

## How to get to it (user POV)

- Sign in → open **Verify Sandbox** classroom
- Click **Curriculum** tab
- See **Curriculum** heading and browse helper text

## Driving it with Playwright

Preconditions:

- Student auth + `npm run verify:seed` (published syllabus in sandbox)

Steps:

1. `npm run verify:feature -- --id student-classroom-curriculum --run <run-id>`
2. **Observable result:** Curriculum tab content or About fallback per seed state

## Gotchas

- Tab button may be `aria-disabled` briefly while classroom loads — driver polls before click
- Unpublished syllabus yields About-tab proof, not a failure
