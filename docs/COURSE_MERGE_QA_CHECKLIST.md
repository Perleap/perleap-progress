# Course merge QA checklist

Optional: `VITE_MERGE_COURSE_PACKAGE_RPC=1` enables Postgres `merge_course_package_v2` for **full-UUID v2** packages only; section/activities without UUID ids stay on the TypeScript merge path. In the UI, **Export** on the classroom always downloads merge-safe v2.

RPC parity summary: exported-from-classroom gate, syllabus id match (`syllabus_mismatch`), PATCH targets scoped to authorized classroom (`is_classroom_teacher`), and updates limited to syllabus rows belonging to that classroom mirror the TS asserts (`assertSectionBelongs`, `assertAssignmentBelongs`, etc.). See comments on `merge_course_package_v2.sql` and the module banner in `coursePackageMergeService.ts`.

## Failure toast (TS merge)

1. Wrong `exported_from_classroom_id` → phase title **exported_from_guard** plus **partial-apply** note.
2. Induce DB error mid-merge (staging): toast shows **phase** (e.g. assignments), optional **human label** / step index / entity id, then **partial-apply** footer.

## Atomic rollback (RPC on)

3. Normal merge succeeds with RPC + valid file.
4. Corrupt assignment id → merge fails; verify classroom syllabus/assignments unchanged from before attempt.

## New syllabus rows

5. Omit one section `id` (keep stable `local_id`); omit or empty **`module_flow_by_section`** (validator); merge inserts section.
6. With any section lacking id, non-empty `module_flow_by_section` must fail parsing.

## Dual-mode import (classroom Course backup)

7. Pick a valid v2 JSON → modal offers **create new classroom** and **merge into this class**; Cancel closes cleanly.
8. **Create new** → new classroom id in URL (`/teacher/classroom/:id`), roster stays empty for students; syllabus/assignments exist.
9. **Merge** → content updates **this** classroom; same export file still fails merge on a different class (`exported_from_guard`).
10. v1 portable file merge path → toast **importMergeNeedsV2** (wizard import still creates a new class from v1 or v2).
11. `importCoursePackageV1` / `applyCoursePackageContentToClassroom`: confirm no submission rows inserted from JSON (`assignment_submissions` / progress tables untouched by import flows).
