# Student join class

Student opens the join-class dialog from the dashboard and enrolls with a teacher invite code.

## Sub-features

- `open-join-dialog` — **Join Class** button opens dialog
- `submit-invite-code` — Enter code and click **Join Classroom**
- `enrollment-visible` — Dialog closes; class appears or already-enrolled error is explicit

## How to get to it (user POV)

- Sign in as student → `/student/dashboard`
- Click **Join Class**
- Enter 6-character invite code → **Join Classroom**

## Driving it with Playwright

Preconditions:

- Student auth state exists
- `VERIFY_INVITE_CODE` set in `.env.verify` (valid unused code, or expect already-enrolled toast)

Steps:

1. `npm run verify:feature -- --id student-join-class --run <run-id>`
2. Helper clicks **Join Class**, fills **Invite Code**, clicks **Join Classroom**
3. **Observable result:** Dialog closes; screenshot shows updated class list or success toast

## Gotchas

- Already enrolled → error toast; use a fresh code or a different student account
- Invalid code → dialog stays open; proof fails by design
- Requires live Supabase enrollment — not a mock
