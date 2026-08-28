# Student complete chat assignment

Student opens the sandbox discussion assignment, completes the AI chat, submits, and submission status becomes `completed`.

## Sub-features

- `open-chat` — Navigate to sandbox chat assignment
- `chat-turns` — Send scripted student messages until conversation complete
- `submit` — Click Complete Activity and wait for feedback
- `db-proof` — Submission row status is `completed`

## How to get to it (user POV)

- Sign in as verify student (sandbox enrolled via `npm run verify:seed`)
- Open **Verify Chat Smoke** from the classroom or direct link `/student/assignment/:id`
- Chat until the assistant marks the conversation complete
- Click **Complete Activity**

## Driving it with Playwright

Preconditions:

- `npm run verify:seed` wrote `fixtures/sandbox.json`
- `npm run verify:launch` and `npm run verify:doctor` pass
- `npm run verify:login -- --role student` on the **same VERIFY_PORT**
- Edge functions `perleap-chat` and `generate-feedback` deployed

Steps:

1. `npm run verify:feature -- --id student-complete-chat --run <run-id>`
2. Or watch live: `npm run verify:watch -- --id student-complete-chat --run <run-id>`
3. Ability-only: `npm run verify:ability -- --name completeChatAssignment`
4. **Observable result:** screenshot + manifest; `fetchAssignment` shows `submission.status === completed`

## Gotchas

- AI latency: up to 120s wait for "Conversation complete!" banner
- Feedback generation: up to 90s after Complete Activity
- Re-runs delete `in_progress` submissions for the sandbox assignment before starting
- Requires `VITE_SUPABASE_SECRET_KEY` for seed and fetch abilities
- Do not use personal dev server on 8080 — use verify launch port
