# Step S5-2 — API rate limits (SEC-006)

**Date:** 2026-08-30  
**Gate:** unit tests pass; edge functions deploy separately to staging

## Change

Wired `checkRateLimit` / `rateLimitFailureToResponse` into **12 additional** user-facing OpenAI proxy functions (16 total with prior 4):

- `perleap-chat`, `transcribe-live-session`
- `generate-feedback`, `evaluate-from-feedback`, `regenerate-scores`
- `generate-followup-assignment`, `generate-student-facing-task`
- `suggest-assignment-hard-skills`, `explain-analytics-5d`, `compute-nuance-insights`
- `extract-unit-memory`, `pilot-readiness`

**Already wired:** `rephrase-text`, `teacher-assistant-chat`, `text-to-speech`, `speech-to-text`

**Skipped (internal/batch):** `analyze-student-wellbeing` (service-role internal), admin probes, batch refresh jobs.

Default limits: 30/min, 200/day per user per function (RPC `check_and_increment_api_rate_limit`).

## Verification

- `npm run test:run` — pass
- Local headed QA (`npm run qa:refactor:watch` @ `127.0.0.1:8086`): **27/27 PASS** (2026-08-30, post S5-2)
- Deploy updated functions to Supabase staging before production traffic relies on limits
