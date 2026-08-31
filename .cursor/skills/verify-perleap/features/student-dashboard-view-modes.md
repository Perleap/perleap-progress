# Student dashboard view modes

Student dashboard grid/table view switcher renders enrolled classrooms in Table mode.

## Sub-features

- `view-switcher` — **View:** combobox (hidden when no classrooms)
- `table-mode` — Table layout lists **Verify Sandbox**

## How to get to it (user POV)

- Sign in as student → `/student/dashboard`
- Use **View:** dropdown → select **Table**
- Classroom names appear in a table

## Driving it with Playwright

Preconditions:

- `npm run verify:login -- --role student`
- Sandbox seed + enrollment (otherwise proof is “view switcher hidden”)

Steps:

1. `npm run verify:feature -- --id student-dashboard-view-modes --run <run-id>`
2. **Observable result:** Table view shows **Verify Sandbox** (or dashboard OK with no switcher)

## Gotchas

- View switcher is hidden when the student has zero classrooms — valid skip-style proof
- i18n key `classroomViewMode` drives option labels; English pinned in verify baseline
