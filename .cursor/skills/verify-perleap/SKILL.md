---
name: verify-perleap
description: Drive the Perleap web app (Vite + React + Supabase) in a browser to prove user-facing behavior. Use after UI changes, before merge, or when an agent must show evidence that student/teacher flows work.
---

# verify-perleap

Scripted verification for the Perleap educational platform. Agents read this cold and follow it literally.

## Preconditions

- Node dependencies installed (`npm install`)
- Chromium for Playwright: `npx playwright install chromium` (one-time)
- App env in [`.env`](../../.env) / [`.env.local`](../../.env.local): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Secrets in **`.env.verify`** (copy from [`.env.verify.example`](../../.env.verify.example), never commit):
  - `VERIFY_STUDENT_EMAIL`, `VERIFY_STUDENT_PASSWORD`
  - `VERIFY_TEACHER_EMAIL`, `VERIFY_TEACHER_PASSWORD`
- Optional: `VERIFY_INVITE_CODE`, `VERIFY_TEACHER_CLASSROOM_ID` (legacy; prefer sandbox seed)
  - `VERIFY_HEADED`, `VERIFY_SLOW_MO`, `VERIFY_KEEP_OPEN` for watch-live runs
  - Default `VERIFY_PORT=8081` (isolated from personal dev on 8080)
- Test accounts: email confirmed, onboarding complete, profiles exist
- Read the feature map index before driving: [`features/README.md`](features/README.md)

## Launch

Start a **dedicated** verify dev server (never drive the user's personal `npm run dev` on 8080):

```bash
npm run verify:launch
```

- Starts Vite on `VERIFY_PORT` (default **8081**)
- Ready when `http://127.0.0.1:8081/auth` returns HTTP 200
- Tracks PID in `.cursor/skills/verify-perleap/.run/server.json`

If port 8081 is taken by a non-verify process, change `VERIFY_PORT` in `.env.verify` or free the port.

## Doctor

Read-only check — run before every drive when anything looks off:

```bash
npm run verify:doctor
npm run verify:doctor -- --role student   # also checks auth state file
```

Doctor verifies:

1. Supabase env vars present
2. Verify base URL responds
3. Port owned by verify run (refuses foreign 8080)
4. Optional: `.auth/<role>.json` exists

## Auth (Google or email/password)

**Auto mode** (default): tries email/password first; if that fails (typical for Google-only accounts), uses a **magic link session** via `VITE_SUPABASE_SECRET_KEY` from `.env.local` — no Google UI automation needed.

```bash
npm run verify:login -- --role student
npm run verify:login -- --role teacher
```

Force a method with `VERIFY_AUTH_MODE=password|magiclink|auto` in `.env.verify`.

Saves Playwright `storageState` to `.cursor/skills/verify-perleap/.auth/<role>.json`. Language pinned to English via `localStorage.language_preference = 'en'`.

## Sandbox seed

Create the permanent **Verify Sandbox** classroom + chat assignment (idempotent):

```bash
npm run verify:seed
```

Writes gitignored [`fixtures/sandbox.json`](fixtures/sandbox.json) with `classroomId`, `inviteCode`, `chatAssignmentId`, and user IDs. Doctor validates this fixture when present.

## Watch live

Visible browser with optional slow-mo:

```bash
# One test, visible browser (sets VERIFY_HEADED=1, default slow-mo 300ms)
npm run verify:watch -- --id student-complete-chat --run watch-1

# All 19 smoke tests, visible browser (same headed + slow-mo defaults)
npm run verify:watch-all -- --run watch-all-1

# Or persist in .env.verify:
# VERIFY_HEADED=1
# VERIFY_SLOW_MO=400
# VERIFY_KEEP_OPEN=1
npm run verify:feature -- --id student-auth-dashboard --run watch-1
```

## Abilities (composable tasks)

Run a single ability without a full feature map entry:

```bash
npm run verify:ability -- --name fetchClassroom
npm run verify:ability -- --name fetchAssignment
npm run verify:ability -- --name openChatAssignment
npm run verify:ability -- --name completeChatAssignment
```

Abilities live under [`abilities/`](abilities/). Features in [`features/registry.mjs`](features/registry.mjs) compose them.

## Drive

Run one feature from the map by ID:

```bash
npm run verify:feature -- --id student-auth-dashboard
npm run verify:feature -- --id student-join-class
npm run verify:feature -- --id teacher-auth-dashboard
npm run verify:feature -- --id teacher-classroom-overview
npm run verify:feature -- --id student-complete-chat
```

Optional stable run id for evidence folder:

```bash
npm run verify:feature -- --id student-auth-dashboard --run 2026-08-28-smoke
```

Feature recipes live under [`features/`](features/). Prefer ARIA roles and English strings from `src/locales/en/translation.json`.

## Evidence

Each run writes to:

```
.cursor/skills/verify-perleap/evidence/<RUN_ID>/
  manifest.json
  <feature-id>.png
```

**Proof standards:**

- Exercise the real user path (UI clicks), not internal APIs
- Capture action **and** resulting screen (screenshot + `finalUrl` in manifest)
- Do not delete evidence during cleanup
- Report unreachable paths with the unmet precondition

## Cleanup

Stop only the verify server this skill started:

```bash
npm run verify:cleanup
```

- Kills PID from `.run/server.json` only — never kill by process name
- Does **not** remove `.auth/` or `evidence/`

## Helpers

| Script | Purpose |
|--------|---------|
| [`helpers/launch.mjs`](helpers/launch.mjs) | Start/stop isolated Vite |
| [`helpers/doctor.mjs`](helpers/doctor.mjs) | Health check |
| [`helpers/login.mjs`](helpers/login.mjs) | Email login → storageState |
| [`helpers/drive-feature.mjs`](helpers/drive-feature.mjs) | Run one feature ID |
| [`helpers/watch-feature.mjs`](helpers/watch-feature.mjs) | Headed drive-feature |
| [`helpers/seed-sandbox.mjs`](helpers/seed-sandbox.mjs) | Idempotent sandbox seed |
| [`helpers/run-ability.mjs`](helpers/run-ability.mjs) | Run one ability by name |

## Typical agent workflow

1. `npm run verify:seed` (once per environment)
2. `npm run verify:launch`
3. `npm run verify:doctor`
4. `npm run verify:login -- --role student` (and teacher if needed)
5. `npm run verify:feature -- --id <feature-id> --run <run-id>`
6. Read `evidence/<run-id>/manifest.json` and screenshot
7. `npm run verify:cleanup`
8. Confirm evidence directory still exists

Or run the full smoke suite (seed, launch, all features, cleanup):

```bash
npm run verify
# or: npm run verify:smoke -- --run my-smoke-run
```

Or run steps 1–6 in one command (falls back to auth-page smoke if `.env.verify` creds are missing):

```bash
npm run verify:proof -- <run-id>
```

## Out of scope

- Live session, pilot report, admin monitoring
- Hebrew/RTL — verify English only
- Mocking AI — chat feature hits real edge functions (may be slow)

## Maintenance

Run `/maintain-verification-skill` when routes or UI copy change.
