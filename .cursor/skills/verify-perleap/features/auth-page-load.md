# Auth page load

Anonymous visitor opens the sign-in page and sees the email auth form (AuthContent refactor).

## Sub-features

- `auth-shell` — `/auth` loads without session
- `sign-in-form` — Heading **Sign in with email** visible

## How to get to it (user POV)

- Open `/auth` while signed out
- Page shows email sign-in form (no dashboard redirect)

## Driving it with Playwright

Preconditions:

- `npm run verify:launch` and `npm run verify:doctor` pass
- No auth storage required (role: anonymous)

Steps:

1. `npm run verify:feature -- --id auth-page-load --run <run-id>`
2. **Observable result:** `finalUrl` ends in `/auth`; screenshot shows **Sign in with email**

## Gotchas

- Uses a fresh browser context without `.auth/*.json` — do not reuse student/teacher storage
- Google OAuth button may appear but is not exercised in automation
