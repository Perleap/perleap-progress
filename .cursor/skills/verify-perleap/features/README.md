# Perleap verification map

Maintained source for user-facing verification. Read this index before driving the app, then open the matching feature file.

## Baseline preconditions

- Copy [`.env.verify.example`](../../../.env.verify.example) → `.env.verify` and fill credentials (gitignored).
- Launch isolated dev server: `npm run verify:launch` (default `http://127.0.0.1:8081`).
- Run `npm run verify:doctor` — must pass before driving.
- Login both roles once per session (or when auth expires):
  - `npm run verify:login -- --role student`
  - `npm run verify:login -- --role teacher`
  - `npm run verify:login -- --role admin` (refactor-regression admin features only)
- Language pinned to **English** (`localStorage.language_preference = en`).
- Never drive a dev server you did not start via `verify:launch`.
- Run `npm run verify:seed` once to create **Verify Sandbox** (`fixtures/sandbox.json`).
- Run full smoke suite: `npm run verify` (alias for `verify:smoke`).

## Driving conventions

- Start from baseline auth state unless a feature file says otherwise.
- Prefer ARIA roles and accessible names over CSS position.
- Use exact English copy from `src/locales/en/translation.json`.
- Run browser steps via `npm run verify:feature -- --id <feature-id>`.
- Restore mutable data after mutation tests; keep proof artifacts.

## Proof and skip reporting

- Capture user action and resulting state (screenshot + `manifest.json`).
- Record `featureId`, `finalUrl`, and `runId` with every artifact.
- If an entry point is unreachable, report the unmet precondition — do not claim verified via a different path.

## Feature entry contract

Each feature file uses four H2 sections: **Sub-features**, **How to get to it (user POV)**, **Driving it with Playwright**, **Gotchas**.

## Features

### Anonymous / Auth

- [auth-page-load](./auth-page-load.md) — Sign-in page without session (AuthContent)

### Student

- [student-auth-dashboard](./student-auth-dashboard.md) — Dashboard shell
- [student-list-classrooms](./student-list-classrooms.md) — Verify Sandbox on dashboard
- [student-dashboard-view-modes](./student-dashboard-view-modes.md) — Grid/Table view switcher
- [student-join-class](./student-join-class.md) — Join via invite code
- [student-classroom-detail](./student-classroom-detail.md) — Classroom About tab
- [student-classroom-curriculum](./student-classroom-curriculum.md) — Curriculum tab (if syllabus published)
- [student-activity-page](./student-activity-page.md) — Open sandbox curriculum activity
- [student-view-assignment-list](./student-view-assignment-list.md) — Open chat assignment by title
- [student-assignment-detail](./student-assignment-detail.md) — Refactored assignment detail shell (Back, title, chat)
- [student-settings-profile](./student-settings-profile.md) — Settings profile form
- [student-open-assignment-readonly](./student-open-assignment-readonly.md) — Chat UI without submit
- [student-open-essay](./student-open-essay.md) — Essay editor loads
- [student-open-quiz-mcq](./student-open-quiz-mcq.md) — MCQ question visible
- [student-open-test-mode](./student-open-test-mode.md) — Test question visible
- [student-complete-chat](./student-complete-chat.md) — Full chat completion + DB proof

### Teacher

- [teacher-auth-dashboard](./teacher-auth-dashboard.md) — Dashboard shell
- [teacher-list-classrooms](./teacher-list-classrooms.md) — Verify Sandbox card
- [teacher-settings-profile](./teacher-settings-profile.md) — Settings profile form
- [teacher-planner-load](./teacher-planner-load.md) — Planner calendar shell
- [teacher-classroom-overview](./teacher-classroom-overview.md) — Classroom detail page
- [teacher-classroom-students-tab](./teacher-classroom-students-tab.md) — Students tab
- [teacher-classroom-submissions-tab](./teacher-classroom-submissions-tab.md) — Submissions tab
- [teacher-classroom-analytics-tab](./teacher-classroom-analytics-tab.md) — Analytics tab
- [teacher-submission-detail](./teacher-submission-detail.md) — Submission detail (needs completed chat)

### Admin

- [admin-ai-prompts](./admin-ai-prompts.md) — Student chat AI prompts page
- [admin-monitoring-overview](./admin-monitoring-overview.md) — Monitoring at-a-glance

## Smoke suite

[`suites/smoke.json`](./suites/smoke.json) — run all: `npm run verify`

## Refactor-regression suite

[`suites/refactor-regression.json`](./suites/refactor-regression.json) — extended gate for Phase 2 refactor QA:

- Includes all smoke features plus `auth-page-load`, `student-dashboard-view-modes`, `student-activity-page`, `teacher-settings-profile`, `teacher-planner-load`, and admin features
- Run locally: `npm run qa:refactor`
- Staging: set `VERIFY_BASE_URL` in `.env.verify` and use bypass token per `SKILL.md`
