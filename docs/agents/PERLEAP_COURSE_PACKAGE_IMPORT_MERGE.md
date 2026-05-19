# Course backup → **merge into this class** (simple guide)

Use this when your goal is: **“Update the class I’m already in — don’t create a brand‑new classroom.”** The app needs to match rows in your file to rows **already in the database**, so the rules are stricter than “new class.”

**Other goal?** Starting a **fresh** class from a file is a different path — see [PERLEAP_COURSE_PACKAGE_IMPORT_NEW_CLASSROOM.md](PERLEAP_COURSE_PACKAGE_IMPORT_NEW_CLASSROOM.md).

For hands-on QA (wrong classroom, partial failure, RPC vs TypeScript): [COURSE_MERGE_QA_CHECKLIST.md](../COURSE_MERGE_QA_CHECKLIST.md).

---

## In plain English

1. **Merge needs Version 2.** If you only have a Version 1 file, the UI will tell you merge is not supported — export again as the merge-safe format from the **same** classroom flow when possible.
2. **Easiest path:** Export from the app for **this** class, change little, re-import. Hand-editing IDs and prerequisites is error-prone.
3. **Valid JSON** only (no comments, no trailing commas).
4. **Assignments ↔ link groups** stay paired: **same count, same order** as in the new-classroom guide.

**Memory hook:** *Merge = database IDs must line up; new class = app can reset more for you.*

---

## What makes merge different

The app must answer: **“Which real row does this piece of JSON belong to?”** So:

- **Assignments** carry a **database ID** (`id`) and point at sections/categories by **those IDs**, not short internal nicknames like `sec_…`.
- The file records **which classroom it was exported from** (`exported_from_classroom_id`). If that does **not** match the class you are merging into, the merge is **blocked** (guards you from applying the wrong backup).
- **New pieces** (sections or activities not yet in the database) use a temporary label (`local_id`) until they exist — the importer checks that web of references carefully.
- If you mix **existing rows (with IDs)** and **new rows (without IDs yet)**, you usually must keep **module flow / lesson order** (`module_flow_by_section`) **empty** until IDs are stable. Filling it too early is rejected on purpose.

---

## File shape (merge / Version 2)

### Everyone must satisfy (shared `course` rules)

- **classroom** object with non-empty **name**.
- **assignments** array.
- **assignment_activity_links** array — **length equals `assignments.length`**.
- **syllabus** absent, null, or a proper object.
- **module_flow_by_section** — if set and not null, must be an array.

### Wrapper (merge)

- `format` = `perleap.course`
- `version` = **2** (only v2 is accepted for merge in the UI)
- `exported_at` — text
- `course` — object
- **`exported_from_classroom_id`** — must be a valid **UUID** and must match the class you merge into (otherwise the merge guard stops you)

### When `course.syllabus` is filled in (the picky part)

- Syllabus and each **grading category** have UUID **`id`**s.
- Each **section** either has a UUID **`id`** (already exists) **or** a non-empty **`local_id`** (will be created).
  - If the section **has** a UUID `id`, it **cannot** use `prerequisites_merge_keys`.
  - `prerequisites_section_ids` lists prerequisites by **UUID** (each non-null entry must reference a section UUID present in **this** syllabus).
  - `prerequisites_merge_keys` only link **brand-new** sections by matching another section’s **`local_id`**.
- Each **activity**: UUID **`id`** or non-empty **`local_id`**.

If **syllabus** is missing, syllabus-only checks are skipped — **assignment and link UUID rules still apply**.

### Assignments, links, and module flow

- Every assignment needs UUID **`id`**.
- **`syllabus_section_ref`** and **`grading_category_ref`**: UUID or `null`.
- **`assignment_activity_links`**: nested arrays; any non-null **`activity_ref`** inside a link object must be a UUID.

**Module flow:**

- Any section **or** activity missing a UUID → **`module_flow_by_section` must be empty** (no lesson-order steps yet).
- If module flow **is** used: its length **matches** how many syllabus **sections** you have (when sections exist); each step uses `resource` vs `assignment` and UUID-or-null refs as appropriate.

Exact rules live in [`validateCoursePackage.ts`](../../src/lib/coursePackage/validateCoursePackage.ts); types in [`coursePackage.ts`](../../src/types/coursePackage.ts).

---

## Friendly detail: partial packages and “who runs merge”

Some backups are **all UUIDs** everywhere; others add **new** sections/activities with only **`local_id`**. That affects **module flow** (above) and can affect whether Postgres RPC merge or the TypeScript merge path handles the job — **your checklist doc** spells out how to toggle and what to regression-test: [COURSE_MERGE_QA_CHECKLIST.md](../COURSE_MERGE_QA_CHECKLIST.md).

---

## Where this shows up in the app

- **Course package** card — **merge into this classroom** ([`CoursePackageCard.tsx`](../../src/components/features/syllabus/CoursePackageCard.tsx)).
- **Wizard** path is geared toward creating a **new** class — merge expectations are heavier on the card flow.

Like the new-class path, merge **does not invent student submissions** from the JSON.

---

## Checklist (merge)

1. Confirm file is **Version 2** and **`exported_from_classroom_id`** matches **this** classroom.
2. Start from a **real export** when possible.
3. Keep **assignments** and **link groups** counts aligned.
4. Watch **UUID** vs **`local_id`** when adding new syllabus pieces; keep **module flow empty** while identities are mixed.
5. Do **not** change `format` casually; **version** must stay **2** for merge.

**Starting a new class instead?** See [PERLEAP_COURSE_PACKAGE_IMPORT_NEW_CLASSROOM.md](PERLEAP_COURSE_PACKAGE_IMPORT_NEW_CLASSROOM.md).

---

## Code pointers

| Topic | Path |
|--------|------|
| Parser / v2 rules | [`src/lib/coursePackage/validateCoursePackage.ts`](../../src/lib/coursePackage/validateCoursePackage.ts) |
| Merge service | [`src/services/coursePackageMergeService.ts`](../../src/services/coursePackageMergeService.ts) |
| Types | [`src/types/coursePackage.ts`](../../src/types/coursePackage.ts) |
| Import + export service | [`src/services/coursePackageService.ts`](../../src/services/coursePackageService.ts) |

Back to [hub / overview](PERLEAP_COURSE_PACKAGE_IMPORT_JSON.md).
