# Step R4 — Overview section cards

**Date:** 2026-08-29  
**Gate:** `npm run qa:refactor` → **27/27 PASS**, 248 unit, i18n clean

## Change

Split `TeacherClassroomOverviewSection.tsx` into six components under `src/components/features/classroom/overview/`:

| Component | Responsibility |
|-----------|----------------|
| `InviteCodeCard` | Invite code display + clipboard copy |
| `CourseInfoCards` | Course title, duration, dates, about/resources |
| `LearningOutcomesChallengesCard` | Learning outcomes + key challenges lists |
| `DomainsAccordion` | Expandable domain/skills accordion |
| `CourseMaterialsGrid` | Downloadable course materials grid |
| `ClassroomActionBar` | Edit / reset / delete actions |

Parent section reduced from ~424 to ~65 lines; orchestrates layout only.

## Verification

- `npm run build` — pass
- `teacher-classroom-overview` E2E — pass (staging)
- Full refactor QA suite — 27/27 pass
