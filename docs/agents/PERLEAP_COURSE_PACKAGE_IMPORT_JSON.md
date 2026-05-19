# Perleap course backup files — start here

Perleap can **import** a JSON **course package** (format `perleap.course`): basically an export of classroom structure (syllabus, assignments, links, and related data).

**Pick the guide that matches what you are doing:**

| I want to… | Open |
|------------|------|
| **Create a new classroom** from a backup file | [PERLEAP_COURSE_PACKAGE_IMPORT_NEW_CLASSROOM.md](PERLEAP_COURSE_PACKAGE_IMPORT_NEW_CLASSROOM.md) |
| **Update the current classroom** (merge the backup into an existing class) | [PERLEAP_COURSE_PACKAGE_IMPORT_MERGE.md](PERLEAP_COURSE_PACKAGE_IMPORT_MERGE.md) |

**Manual QA** (merge guards, partial failure, optional RPC path): [COURSE_MERGE_QA_CHECKLIST.md](../COURSE_MERGE_QA_CHECKLIST.md).

---

## True for both paths

- File must be **valid JSON** (no comments, no trailing commas).
- **`assignments`** and **`assignment_activity_links`** must stay **paired**: same number of entries, same order.
- The app checks the file with [`parseCoursePackageJson`](../../src/lib/coursePackage/validateCoursePackage.ts) before import.

---

## Where to look in code

| Topic | Path |
|--------|------|
| Data shapes | [`src/types/coursePackage.ts`](../../src/types/coursePackage.ts) |
| Parser / validation | [`src/lib/coursePackage/validateCoursePackage.ts`](../../src/lib/coursePackage/validateCoursePackage.ts) |
| New-class sanitization | [`src/services/coursePackageNewImportUtils.ts`](../../src/services/coursePackageNewImportUtils.ts), [`src/lib/coursePackage/v2ToV1Portable.ts`](../../src/lib/coursePackage/v2ToV1Portable.ts) |
| Merge logic | [`src/services/coursePackageMergeService.ts`](../../src/services/coursePackageMergeService.ts) |
| Import / export | [`src/services/coursePackageService.ts`](../../src/services/coursePackageService.ts) |
