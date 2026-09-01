# Step P3-6 — ClassroomAnalytics section split

**Date:** 2026-09-01

## What changed

- Split `ClassroomAnalytics.tsx` (~1179→~69 lines) into five section components under `src/components/features/analytics/sections/`:
  - `AnalyticsFiltersActionsSection` — export CSV, lesson brief, pilot report, regenerate, `AnalyticsFilterControls`
  - `AnalyticsKpiMetricsSection` — four KPI stat cards
  - `AnalyticsVideoCoverageSection` — video engagement, coverage banner, `AnalyticsCompare5dCard`
  - `AnalyticsMainChartsSection` — class average 5D, hard skills tables, student collapsibles
  - `AnalyticsPerformanceSummarySection` — sticky performance summary sidebar
- Extracted shared computed state into `useClassroomAnalyticsViewModel.ts`; `useClassroomAnalytics` remains the data source in the orchestrator
- URL params (`analyticsModule`, `analyticsAssignment`, `analyticsStudent`) and RTL behavior preserved

## Manual live QA

| Feature | Run | Result |
|---------|-----|--------|
| `teacher-classroom-analytics-tab` | `p3-t6-gate` | PASS |
