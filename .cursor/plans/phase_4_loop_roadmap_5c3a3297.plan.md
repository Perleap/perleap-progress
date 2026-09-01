---
name: Phase 4 loop roadmap
overview: Migrate legacy root components to feature modules; deep-refactor marketing pages. Local verify gate after each task.
todos:
  - id: p4-1-dead-common
    content: P4-1 — Delete dead root components; move PerleapLogo/ThemeToggle/LanguageSwitcher to common/
    status: completed
  - id: p4-2-shared-settings-submission
    content: P4-2 — Move SafeMathMarkdown, DeleteAccountDialog, WellbeingAlertCard
    status: completed
  - id: p4-3-assignment-classroom
    content: P4-3 — Move AssignmentCourseOutlineLinkCard + classroom profile dialog cluster
    status: completed
  - id: p4-4-calendars
    content: P4-4 — Move StudentCalendar + TeacherCalendar to features/dashboard/
    status: completed
  - id: p4-5-analytics-charts
    content: P4-5 — Move RadarChart/FiveDChart; rename StudentAnalytics → StudentAnalyticsPanel
    status: completed
  - id: p4-6-analytics-submission-large
    content: P4-6 — Move HardSkillsAssessmentTable + SubmissionCard
    status: completed
  - id: p4-7-protected-route
    content: P4-7 — Move ProtectedRoute to features/auth/
    status: completed
  - id: p4-8-marketing-verify
    content: P4-8 — Register 4 marketing verify features + marketing-smoke suite
    status: completed
  - id: p4-9-marketing-shell
    content: P4-9 — ContactUs shell unification + Footer real links
    status: completed
  - id: p4-10-landing-merge
    content: P4-10 — Merge landing/ into marketing/sections; thin Landing page
    status: completed
  - id: p4-11-marketing-bodies
    content: P4-11 — Extract Product/Solutions/AboutUs content components
    status: completed
  - id: p4-12-landing-auth-i18n-pricing
    content: P4-12 — useLandingAuthRedirect + i18n + pricing/contact UI polish
    status: completed
  - id: p4-13-marketing-primitives
    content: P4-13 — Shared MarketingHero/MarketingCta primitives
    status: completed
  - id: p4-14-ci-marketing
    content: P4-14 — Add marketing features to ci-smoke (8 total)
    status: completed
  - id: p4-capstone
    content: P4-capstone — qa:refactor + marketing-smoke local; close Phase 4 in docs
    status: completed
---

# Phase 4 loop roadmap

See plan details in agent transcript. Next task: **Phase 4 complete.**

Per-task gate: `npm run test:run` + local `verify:feature` (see step docs).

Loop prompt:

```
Execute the next incomplete P4 task from .cursor/plans/phase_4_loop_roadmap_5c3a3297.plan.md.
Implement, gate with local verify, write docs/qa/step-p4-*.md + FIX-LOG, mark todo complete.
Do not commit unless I ask.
```
