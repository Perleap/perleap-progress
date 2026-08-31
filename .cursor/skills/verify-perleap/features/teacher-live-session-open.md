# Teacher live session open

Teacher opens a seeded live session in **ready** state and sees summary + evaluation UI.

## Sub-features

- `live-session-route` — `/teacher/classroom/:id/live-session/:assignmentId` loads
- `live-session-ready` — **Summary** and **Student evaluations** headings visible

## Preconditions

- `npm run verify:seed` (creates `liveSessionAssignmentId` in sandbox fixture)
- `npm run verify:login -- --role teacher`

## Steps

1. `npm run verify:feature -- --id teacher-live-session-open --run <run-id>`
2. **Observable result:** Summary card and student evaluation section in screenshot

## Gotchas

- Does not upload audio or call transcription — session is seeded with `status: ready`
- Re-run seed if `Live session not found` appears
