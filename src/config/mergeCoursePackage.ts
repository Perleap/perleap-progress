import type { PerleapCoursePackageV2 } from '@/types/coursePackage';

function isUuidLike(s: string): boolean {
  const t = s.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t);
}

/** When true, merge uses Postgres RPC (single transaction) for strict UUID snapshots only. */
export function shouldUseCoursePackageMergeRpc(): boolean {
  const v = import.meta.env.VITE_MERGE_COURSE_PACKAGE_RPC;
  return v === 'true' || v === '1';
}

/** RPC path does not support inserts for sections/activities without DB ids. */
export function packageNeedsTypescriptCourseMerge(pkg: PerleapCoursePackageV2): boolean {
  const syl = pkg.course.syllabus;
  if (!syl) return false;
  for (const sec of syl.sections) {
    const sid = typeof sec.id === 'string' ? sec.id.trim() : '';
    if (!sid || !isUuidLike(sid)) return true;
    for (const act of sec.activities) {
      const aid = typeof act.id === 'string' ? act.id.trim() : '';
      if (!aid || !isUuidLike(aid)) return true;
    }
  }
  return false;
}
