# Course backup → **new classroom** (simple guide)

Use this when your goal is: **“Start a new class from this backup file.”** The app will create a **fresh** classroom and copy structure and content from the bundle.

**Other goal?** Updating a class you already have is **merge** — see [PERLEAP_COURSE_PACKAGE_IMPORT_MERGE.md](PERLEAP_COURSE_PACKAGE_IMPORT_MERGE.md).

General QA ideas: [COURSE_MERGE_QA_CHECKLIST.md](../COURSE_MERGE_QA_CHECKLIST.md) (some items are merge-specific; still useful context).

---

## In plain English

1. **Easiest path:** Export the file from Perleap, then change **as little as possible.** Hand-building a file is easy to get wrong.
2. You may use a **Version 1** or **Version 2** export for this flow — the app **normalizes** everything for a clean start (see below).
3. Keep **valid JSON** (no comments, no trailing commas).
4. **Assignments and “link” rows stay paired:** one list of assignments, one list of link-groups — **same length, same order.** If you remove assignment #4, remove link group #4 too.

**Memory hook:** *Same number of assignment rows as link rows.*

---

## What the file must look like (wrapper + course)

The bundle is always labeled `perleap.course` and includes when it was made (`exported_at`) plus a **`course`** object with the real content.

Under **`course`**, you need at least:

- **classroom** — an object with a non-empty **name** (how the class is labeled).
- **assignments** — a list (can be empty).
- **assignment_activity_links** — a list with **one entry per assignment**, in the same order.

**Syllabus** may be present or empty depending on what was exported; wrong shapes get rejected by the importer.

---

## What the app **changes for you** on “new classroom”

So you are not surprised after import, the app **cleans** the bundle before creating the new class (see [`coursePackageNewImportUtils.ts`](../../src/services/coursePackageNewImportUtils.ts)):

| What you might have in the file | What happens on new classroom |
|--------------------------------|------------------------------|
| A **database ID** tucked under `classroom` | **Removed** — the new class gets its own identity. |
| **Per-student assignment targeting** (`assigned_student_id`) | **Cleared** — no one is pre-assigned from the file. |
| **Extra random fields** at the **top** of the file (outside the known labels) | **Dropped** — only known top-level fields are kept: `format`, `version`, `exported_at`, optional `source_classroom_name`, and `course`. |

If your file is **Version 2**, it is **converted** to the portable shape first, then the same cleanup runs.

**Do not rely on** mystery top-level notes or student-specific assignment flags surviving this path.

---

## Version 1 vs Version 2 here (short)

| Version | How to think about it for *new class* |
|--------|----------------------------------------|
| **1** | Portable snapshot; friendlier for “copy structure.” The importer checks the **shared** course rules (classroom name, assignment/link lists, etc.) — not the heavy database-ID syllabus rules used in merge. |
| **2** | Merge-style snapshot (full of database IDs). **Still works** for new class: the app converts it down for you, then applies the cleanup above. You still need a valid v2 file if you start from v2 (including `exported_from_classroom_id` — see technical note below). |

---

## Technical notes (when the file is rejected)

The importer runs [`parseCoursePackageJson`](../../src/lib/coursePackage/validateCoursePackage.ts). Summary for **new classroom**:

- **Wrapper:** `format` = `perleap.course`; `version` **1** or **2**; `exported_at` text; `course` object present.
- **Version 2 only:** `exported_from_classroom_id` must be a valid **UUID** so the file **parses** — the new-classroom flow does **not** use it to decide permissions, but the field must be valid format.
- **Both versions — `course`:** classroom object + non-empty name; `assignments` array; `assignment_activity_links` array with **length = assignments length**; syllabus null/object; `module_flow_by_section` array or absent/null if not an array.
- **Optional activity fields** (`estimated_duration_minutes`, `summary`, `body_text`, `file_path`, `url`, `mime_type`, `file_size`) may appear in exports or GPT-built JSON. The importer **does not send** these on the first activity insert (lessons still use `lesson_content`). You do not need to hand-strip them from the file. On databases that support those columns, set duration or file metadata in the UI after import.
- **Assignment `type`** must be a valid Postgres enum (`chatbot`, `text_essay`, `test`, etc.). GPT sometimes uses **`submission`** (meaning “hand in work”) — that is **not** a valid type. The importer maps `submission` → `chatbot` automatically; prefer `chatbot` or `text_essay` in hand-built JSON.

**Version 1** `course` checks stop at the shared rules (no v2 UUID syllabus validation in the parser).

Types and field meanings: [`src/types/coursePackage.ts`](../../src/types/coursePackage.ts).

---

## Where this shows up in the app

- **Create Classroom** wizard — import path ([`CreateClassroomWizard.tsx`](../../src/components/features/syllabus/CreateClassroomWizard.tsx)).
- **Course package** card — “create new class” style import ([`CoursePackageCard.tsx`](../../src/components/features/syllabus/CoursePackageCard.tsx)).

Importing course content **does not create student submission / grading rows** from the file — only structure and assignments (see comments in [`coursePackageNewImportUtils.ts`](../../src/services/coursePackageNewImportUtils.ts)).

---

## Checklist (new classroom)

1. Prefer a **real export** from the product.
2. Keep JSON **strictly valid**.
3. **Match** `assignments.length` and `assignment_activity_links.length`.
4. Do **not** expect **classroom database IDs** or **assigned_student_id** to carry through.
5. Do **not** hide important notes in **extra top-level** fields — they disappear.
6. Do **not** change `format` / `version` casually.

**Merging into an existing class instead?** Switch to [PERLEAP_COURSE_PACKAGE_IMPORT_MERGE.md](PERLEAP_COURSE_PACKAGE_IMPORT_MERGE.md).

---

## Code pointers

| Topic | Path |
|--------|------|
| Parser | [`src/lib/coursePackage/validateCoursePackage.ts`](../../src/lib/coursePackage/validateCoursePackage.ts) |
| New-class cleanup / v2→portable | [`src/services/coursePackageNewImportUtils.ts`](../../src/services/coursePackageNewImportUtils.ts), [`src/lib/coursePackage/v2ToV1Portable.ts`](../../src/lib/coursePackage/v2ToV1Portable.ts) |
| Import services | [`src/services/coursePackageService.ts`](../../src/services/coursePackageService.ts) |

Back to [hub / overview](PERLEAP_COURSE_PACKAGE_IMPORT_JSON.md).
