/**
 * Portable course package (v1). Logical IDs in-file; import assigns new UUIDs.
 */

import type { Json } from '@/integrations/supabase/types';
import type { DbAssignmentStatus, DbAssignmentType } from '@/types/models';

export const COURSE_PACKAGE_FORMAT = 'perleap.course' as const;
export const COURSE_PACKAGE_VERSION = 1 as const;
/** Merge-safe packages: preserves DB UUIDs for in-place PATCH import. */
export const COURSE_PACKAGE_VERSION_V2 = 2 as const;

export type CoursePackagePolicyV1 = {
  type: string;
  label: string;
  content: string;
  order_index: number;
};

export type CoursePackageGradingCategoryV1 = {
  local_id: string;
  name: string;
  weight: number;
};

export type CoursePackageActivityV1 = {
  local_id: string;
  resource_type: string;
  title: string;
  order_index: number;
  status: string;
  lesson_content: Json | null;
  summary: string | null;
  body_text: string | null;
  file_path: string | null;
  url: string | null;
  mime_type: string | null;
  file_size: number | null;
  estimated_duration_minutes: number | null;
};

export type CoursePackageSectionV1 = {
  local_id: string;
  title: string;
  description: string | null;
  content: string | null;
  order_index: number;
  start_date: string | null;
  end_date: string | null;
  objectives: string[] | null;
  resources: string | null;
  notes: string | null;
  completion_status: string;
  prerequisites_local_ids: string[];
  is_locked: boolean;
  activities: CoursePackageActivityV1[];
};

export type CoursePackageSyllabusV1 = {
  title: string;
  summary: string | null;
  structure_type: string;
  policies: CoursePackagePolicyV1[];
  status: string;
  release_mode: string;
  published_at: string | null;
  accent_color: string | null;
  banner_url: string | null;
  section_label_override: string | null;
  custom_settings: Record<string, unknown>;
  grading_categories: CoursePackageGradingCategoryV1[];
  sections: CoursePackageSectionV1[];
};

export type CoursePackageAssignmentV1 = {
  local_id: string;
  syllabus_section_ref: string | null;
  grading_category_ref: string | null;
  title: string;
  instructions: string;
  student_facing_task: string | null;
  type: DbAssignmentType;
  status: DbAssignmentStatus;
  due_at: string | null;
  target_dimensions: Json;
  personalization_flag: boolean;
  enable_ai_feedback: boolean;
  auto_publish_ai_feedback: boolean;
  attempt_mode: string | null;
  materials: Json | null;
  hard_skills: string | null;
  hard_skill_domain: string | null;
  assigned_student_id: string | null;
};

export type CoursePackageModuleFlowStepV1 = {
  order_index: number;
  step_kind: 'resource' | 'assignment';
  activity_ref: string | null;
  assignment_ref: string | null;
};

export type CoursePackageAssignmentActivityLinkV1 = {
  activity_ref: string;
  order_index: number;
  include_in_ai_context: boolean;
};

export type CoursePackageClassroomV1 = {
  name: string;
  subject: string | null;
  goals: string | null;
  course_title: string | null;
  course_duration: string | null;
  start_date: string | null;
  end_date: string | null;
  course_outline: string | null;
  resources: string | null;
  learning_outcomes: Json | null;
  key_challenges: Json | null;
  domains: Json | null;
  materials: Json | null;
};

export type CoursePackageCourseV1 = {
  classroom: CoursePackageClassroomV1;
  syllabus: CoursePackageSyllabusV1 | null;
  assignments: CoursePackageAssignmentV1[];
  assignment_activity_links: CoursePackageAssignmentActivityLinkV1[][];
  module_flow_by_section: CoursePackageModuleFlowStepV1[][] | null;
};

export type PerleapCoursePackageV1 = {
  format: typeof COURSE_PACKAGE_FORMAT;
  version: typeof COURSE_PACKAGE_VERSION;
  exported_at: string;
  source_classroom_name?: string | null;
  course: CoursePackageCourseV1;
};

export type CoursePackageGradingCategoryV2 = {
  id: string;
  name: string;
  weight: number;
};

/** `id` present = PATCH existing row; omitted = INSERT (requires stable `local_id`). */
export type CoursePackageActivityV2 = CoursePackageActivityV1 & { id?: string };

/** Prerequisites to existing UUID sections; `prerequisites_merge_keys` reference other sections' `local_id` (for rows without UUID yet). */
export type CoursePackageSectionV2 = Omit<CoursePackageSectionV1, 'prerequisites_local_ids' | 'activities'> & {
  id?: string;
  prerequisites_section_ids: string[];
  prerequisites_merge_keys?: string[];
  activities: CoursePackageActivityV2[];
};

export type CoursePackageSyllabusV2 = Omit<CoursePackageSyllabusV1, 'grading_categories' | 'sections'> & {
  id: string;
  grading_categories: CoursePackageGradingCategoryV2[];
  sections: CoursePackageSectionV2[];
};

/** Assignment refs are UUIDs of syllabus_sections / grading_categories (not local sec_ / gc_ ids). */
export type CoursePackageAssignmentV2 = Omit<CoursePackageAssignmentV1, 'local_id'> & {
  /** DB assignment UUID (required for merge). */
  id: string;
  /** Optional disposable local reference for tooling; importer ignores for matching. */
  local_id?: string;
};

/** activity_ref values are activity_list UUIDs. */
export type CoursePackageAssignmentActivityLinkV2 = CoursePackageAssignmentActivityLinkV1;
export type CoursePackageModuleFlowStepV2 = CoursePackageModuleFlowStepV1;

export type CoursePackageCourseV2 = {
  classroom: CoursePackageClassroomV1 & { id?: string };
  syllabus: CoursePackageSyllabusV2 | null;
  assignments: CoursePackageAssignmentV2[];
  assignment_activity_links: CoursePackageAssignmentActivityLinkV2[][];
  module_flow_by_section: CoursePackageModuleFlowStepV2[][] | null;
};

export type PerleapCoursePackageV2 = {
  format: typeof COURSE_PACKAGE_FORMAT;
  version: typeof COURSE_PACKAGE_VERSION_V2;
  exported_at: string;
  source_classroom_name?: string | null;
  /** Origin classroom UUID; merge rejects if mismatched against target classroom. */
  exported_from_classroom_id: string;
  course: CoursePackageCourseV2;
};

export type PerleapCoursePackageAny = PerleapCoursePackageV1 | PerleapCoursePackageV2;

export function isPerleapCoursePackageV2(pkg: PerleapCoursePackageAny): pkg is PerleapCoursePackageV2 {
  return pkg.version === COURSE_PACKAGE_VERSION_V2;
}
