/**
 * Normalize course packages from disk for teacher-driven "Import as new classroom".
 * Content shape drives inserts only; exporter metadata (origin classroom UUID on v2) is not trusted for authorization.
 * New syllabi/sections/assignments/get new DB rows — see importCoursePackageV1 → applyCoursePackageContentToClassroom.
 *
 * Imports never create submission rows: applyCoursePackageContentToClassroom only inserts syllabus/activities/assignments/module flow.
 */

import type {
  CoursePackageClassroomV1,
  CoursePackageCourseV1,
  PerleapCoursePackageAny,
  PerleapCoursePackageV1,
} from '@/types/coursePackage';
import { COURSE_PACKAGE_VERSION, isPerleapCoursePackageV2 } from '@/types/coursePackage';
import { coursePackageV2ToV1Portable } from '@/lib/coursePackage/v2ToV1Portable';

/** Malicious or legacy JSON may bolt on extra keys — never persist them downstream. */
type ClassroomJson = CoursePackageClassroomV1 & { id?: string };

function stripClassroomLeakedUuid(cc: CoursePackageClassroomV1): CoursePackageClassroomV1 {
  const { id: _omit, ...rest } = cc as ClassroomJson;
  return rest;
}

function sanitizeAssignmentsForFreshClass(course: CoursePackageCourseV1): CoursePackageCourseV1 {
  const assignments = course.assignments.map((a) => ({
    ...a,
    assigned_student_id: null as typeof a.assigned_student_id,
  }));

  return {
    ...course,
    classroom: stripClassroomLeakedUuid(course.classroom),
    assignments,
  };
}

/** Keep only envelope fields TypeScript knows about — drops unknown top-level keys from parsed JSON. */
function strictPortableV1Envelope(pkg: PerleapCoursePackageV1): PerleapCoursePackageV1 {
  return {
    format: pkg.format,
    version: pkg.version,
    exported_at: pkg.exported_at,
    source_classroom_name: pkg.source_classroom_name ?? null,
    course: sanitizeAssignmentsForFreshClass(pkg.course),
  };
}

export function packageForNewClassroomFromAny(pkg: PerleapCoursePackageAny): PerleapCoursePackageV1 {
  let v1: PerleapCoursePackageV1;

  if (isPerleapCoursePackageV2(pkg)) {
    v1 = coursePackageV2ToV1Portable(pkg);
  } else if (pkg.version !== COURSE_PACKAGE_VERSION) {
    throw new Error('Unsupported course package version for new-classroom import.');
  } else {
    v1 = pkg;
  }

  return strictPortableV1Envelope(v1);
}
