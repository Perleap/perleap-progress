# Teacher submission detail

Teacher opens a student submission from the sandbox classroom and lands on the submission detail shell.

## Sub-features

- `open-submission` — Deep link to `/teacher/submission/:id` using sandbox completed submission
- `detail-shell` — Student name heading visible; classroom layout with Submissions nav

## How to get to it (user POV)

- From classroom **Submissions** tab, click a student submission row
- Or navigate directly to `/teacher/submission/<id>` when a completed sandbox submission exists

## Driving it with Playwright

Preconditions:

- Teacher auth state exists
- `npm run verify:seed` completed (`fixtures/sandbox.json`)
- At least one **completed** student submission on the sandbox chat assignment (run `student-complete-chat` once if none)

Steps:

1. `npm run verify:feature -- --id teacher-submission-detail --run <run-id>`
2. **Observable result:** `finalUrl` contains `/teacher/submission/`; screenshot shows student name `h1` and Submissions sidebar entry

## Gotchas

- No submissions yet — run `student-complete-chat` first to create a completed sandbox submission
- Teacher preview attempts (`is_teacher_attempt`) are excluded from the admin lookup
- AI feedback tabs may still be generating; smoke test only asserts the page shell, not feedback content
