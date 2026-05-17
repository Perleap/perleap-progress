/**
 * Parse and validate perleap.course v1 / v2 JSON from unknown input.
 */

import type { PerleapCoursePackageAny, PerleapCoursePackageV1, PerleapCoursePackageV2 } from '@/types/coursePackage';
import {
  COURSE_PACKAGE_FORMAT,
  COURSE_PACKAGE_VERSION,
  COURSE_PACKAGE_VERSION_V2,
} from '@/types/coursePackage';

export type ParseCoursePackageResult =
  | { ok: true; data: PerleapCoursePackageAny }
  | { ok: false; error: string };

function isUuid(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t);
}

function validateCourseCommon(course: Record<string, unknown>): string | null {
  if (course.classroom === null || typeof course.classroom !== 'object') {
    return 'Missing course.classroom';
  }
  const cls = course.classroom as Record<string, unknown>;
  if (typeof cls.name !== 'string' || !cls.name.trim()) {
    return 'course.classroom.name is required';
  }
  if (!Array.isArray(course.assignments)) {
    return 'course.assignments must be an array';
  }
  if (!Array.isArray(course.assignment_activity_links)) {
    return 'course.assignment_activity_links must be an array';
  }
  if (course.assignment_activity_links.length !== course.assignments.length) {
    return 'course.assignment_activity_links length must match course.assignments';
  }
  if (course.syllabus !== null && course.syllabus !== undefined && typeof course.syllabus !== 'object') {
    return 'course.syllabus must be object or null';
  }
  if (course.module_flow_by_section !== null && course.module_flow_by_section !== undefined) {
    if (!Array.isArray(course.module_flow_by_section)) {
      return 'course.module_flow_by_section must be array or null';
    }
  }
  return null;
}

function validateCourseV2Shape(course: Record<string, unknown>): string | null {
  const common = validateCourseCommon(course);
  if (common) return common;

  let syllabusHasPartialIdentity = false;
  const sylRaw = course.syllabus as Record<string, unknown> | null | undefined;
  if (sylRaw !== null && sylRaw !== undefined && typeof sylRaw === 'object') {
    if (!isUuid(sylRaw.id)) return 'course.syllabus.id must be a UUID';
    const gcs = sylRaw.grading_categories as unknown[];
    if (!Array.isArray(gcs)) return 'course.syllabus.grading_categories invalid';
    for (let i = 0; i < gcs.length; i++) {
      const g = gcs[i];
      if (g === null || typeof g !== 'object')
        return 'course.syllabus.grading_categories entries must be objects';
      const gr = g as Record<string, unknown>;
      if (!isUuid(gr.id)) return `grading category at index ${i} must have UUID id`;
    }
    const secs = sylRaw.sections as unknown[];
    if (!Array.isArray(secs)) return 'course.syllabus.sections invalid';
    const uuidSectionIds = new Set<string>();
    const localIdsNeedingInsert = new Set<string>();

    for (let si = 0; si < secs.length; si++) {
      const s = secs[si];
      if (s === null || typeof s !== 'object') return 'Invalid syllabus section row';
      const sec = s as Record<string, unknown>;
      const lid = typeof sec.local_id === 'string' ? sec.local_id.trim() : '';
      const rawId = sec.id;
      const hasUuidId = rawId != null && String(rawId).trim() !== '' && isUuid(rawId);

      if (hasUuidId) {
        const sid = String(rawId).trim();
        uuidSectionIds.add(sid);
        const mk = sec.prerequisites_merge_keys;
        if (Array.isArray(mk) && mk.length > 0) {
          return `section at index ${si}: prerequisites_merge_keys only allowed when section omits id`;
        }
      } else {
        if (!lid) return `section at index ${si} must have UUID id or non-empty local_id`;
        localIdsNeedingInsert.add(lid);
        syllabusHasPartialIdentity = true;
      }

      const prereqs = sec.prerequisites_section_ids;
      if (!Array.isArray(prereqs)) return 'prerequisites_section_ids must be array';
      for (const p of prereqs) {
        if (p !== null && !isUuid(p)) return 'prerequisite_section id must be UUID';
      }

      const mkArr = sec.prerequisites_merge_keys;
      if (mkArr != null && !Array.isArray(mkArr)) return 'prerequisites_merge_keys must be array when present';
      if (Array.isArray(mkArr)) {
        for (const k of mkArr) {
          if (typeof k !== 'string' || !k.trim()) return 'prerequisites_merge_keys must be non-empty strings';
        }
      }

      const acts = sec.activities;
      if (!Array.isArray(acts)) return 'section.activities invalid';
      for (let ai = 0; ai < acts.length; ai++) {
        const ar = acts[ai];
        if (ar === null || typeof ar !== 'object') return 'Invalid activity row';
        const row = ar as Record<string, unknown>;
        const actId = row.id;
        const hasActUuid = actId != null && String(actId).trim() !== '' && isUuid(actId);
        const actLid = typeof row.local_id === 'string' ? row.local_id.trim() : '';
        if (hasActUuid) {
          /* ok */
        } else {
          if (!actLid) return `activity at sec ${si}/${ai} must have UUID id or non-empty local_id`;
          syllabusHasPartialIdentity = true;
        }
      }
    }

    for (let si = 0; si < secs.length; si++) {
      const sec = secs[si] as Record<string, unknown>;
      const prereqs = sec.prerequisites_section_ids as unknown[];
      for (const p of prereqs) {
        if (isUuid(p) && !uuidSectionIds.has(String(p).trim()))
          return 'prerequisite references unknown section id';
      }
      const mkArr = (sec.prerequisites_merge_keys ?? []) as unknown[];
      for (const k of mkArr) {
        const ks = String(k).trim();
        if (!localIdsNeedingInsert.has(ks)) return 'prerequisite_merge_key references unknown new section local_id';
      }
    }
  }

  const assigns = course.assignments as unknown[];
  for (let i = 0; i < assigns.length; i++) {
    const a = assigns[i];
    if (a === null || typeof a !== 'object') return 'invalid assignment row';
    const row = a as Record<string, unknown>;
    if (!isUuid(row.id)) return `assignment at index ${i} must include UUID id`;
    if (row.syllabus_section_ref != null && !isUuid(row.syllabus_section_ref)) {
      return 'assignment syllabus_section_ref must be UUID or null';
    }
    if (row.grading_category_ref != null && !isUuid(row.grading_category_ref)) {
      return 'assignment grading_category_ref must be UUID or null';
    }
  }

  const linksArr = course.assignment_activity_links as unknown[];
  for (let i = 0; i < linksArr.length; i++) {
    const entry = linksArr[i];
    if (!Array.isArray(entry)) return 'assignment_activity_links must be array-of-arrays';
    for (const l of entry) {
      if (l === null || typeof l !== 'object') continue;
      const row = l as Record<string, unknown>;
      if (row.activity_ref != null && !isUuid(row.activity_ref)) return 'invalid activity_ref';
    }
  }

  const mf = course.module_flow_by_section as unknown[] | null | undefined;
  if (
    syllabusHasPartialIdentity &&
    mf !== null &&
    mf !== undefined &&
    Array.isArray(mf) &&
    mf.length > 0
  ) {
    return 'module_flow_by_section must be empty when any syllabus section or activity omits a UUID id';
  }
  if (mf !== null && mf !== undefined && Array.isArray(mf)) {
    for (let si = 0; si < mf.length; si++) {
      const row = mf[si];
      if (!Array.isArray(row)) return 'module_flow_by_section rows must be arrays';
      for (const st of row) {
        if (st === null || typeof st !== 'object') return 'invalid flow step';
        const os = st as Record<string, unknown>;
        const sk = os.step_kind;
        if (sk !== 'resource' && sk !== 'assignment') return 'invalid step_kind';
        if (sk === 'resource' && os.activity_ref != null && !isUuid(os.activity_ref)) {
          return 'flow activity_ref must be UUID or null';
        }
        if (sk === 'assignment' && os.assignment_ref != null && !isUuid(os.assignment_ref)) {
          return 'flow assignment_ref must be UUID or null';
        }
      }
    }
    if (
      typeof sylRaw === 'object' &&
      sylRaw !== null &&
      Array.isArray(sylRaw.sections) &&
      mf.length !== sylRaw.sections.length
    ) {
      return 'module_flow_by_section length must match syllabus sections when present';
    }
  }

  return null;
}

export function parseCoursePackageJson(raw: unknown): ParseCoursePackageResult {
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid JSON: expected an object' };
  }
  const o = raw as Record<string, unknown>;
  if (o.format !== COURSE_PACKAGE_FORMAT) {
    return { ok: false, error: `Unknown format: expected "${COURSE_PACKAGE_FORMAT}"` };
  }
  if (typeof o.exported_at !== 'string') {
    return { ok: false, error: 'Missing exported_at' };
  }
  if (o.course === null || typeof o.course !== 'object') {
    return { ok: false, error: 'Missing course object' };
  }

  const course = o.course as Record<string, unknown>;
  const ver = o.version;

  if (ver === COURSE_PACKAGE_VERSION) {
    const err = validateCourseCommon(course);
    if (err) return { ok: false, error: err };
    return { ok: true, data: raw as PerleapCoursePackageV1 };
  }

  if (ver === COURSE_PACKAGE_VERSION_V2) {
    if (!isUuid(o.exported_from_classroom_id)) {
      return { ok: false, error: 'exported_from_classroom_id must be a UUID (merge-safe package)' };
    }
    const errV2 = validateCourseV2Shape(course);
    if (errV2) return { ok: false, error: errV2 };
    return { ok: true, data: raw as PerleapCoursePackageV2 };
  }

  return { ok: false, error: `Unsupported version: ${String(ver)}` };
}
