# Student open assignment readonly

Student opens the chat assignment and reaches an interactive-ready state without submitting.

## Sub-features

- `open-chat` — Chat input or feedback/retry affordance visible
- `no-submit` — Proof stops at UI ready (no message send)

## How to get to it (user POV)

- Open **Verify Chat Smoke** assignment
- See chat input **Type your message here...** or prior attempt feedback

## Driving it with Playwright

Preconditions:

- Student auth + sandbox `chatAssignmentId`
- Uses `freshAttempt` path when **Start another attempt** is shown

Steps:

1. `npm run verify:feature -- --id student-open-assignment-readonly --run <run-id>`
2. **Observable result:** Chat input ready, feedback visible, or fresh attempt started

## Gotchas

- Prior completed attempts may show **View Feedback** instead of input — still valid proof
- Driver may click **Start another attempt** to reach editable chat
- Pair with `student-complete-chat` to prove full submit flow
