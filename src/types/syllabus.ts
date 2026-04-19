/**
 * Syllabus Types
 * TypeScript interfaces for syllabus-related entities
 */

export type SyllabusStructureType = 'weeks' | 'units' | 'modules';
export type SyllabusStatus = 'draft' | 'published' | 'archived';
export type ResourceType = 'file' | 'video' | 'link' | 'document' | 'image' | 'text' | 'lesson';

/** Single text segment in a v1 lesson */
export interface LessonTextBlockV1 {
  id: string;
  type: 'text';
  body: string;
}

/** Single uploaded or linked video in a v1 lesson */
export interface LessonVideoBlockV1 {
  id: string;
  type: 'video';
  url: string | null;
  file_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  display_name: string;
}

export type LessonBlockV1 = LessonTextBlockV1 | LessonVideoBlockV1;

/** Stored in section_resources.lesson_content for resource_type lesson */
export interface LessonContentV1 {
  version: 1;
  blocks: LessonBlockV1[];
}
/** draft = teacher-only; published = students see when syllabus is published */
export type ActivityResourceStatus = 'draft' | 'published';
export type CompletionStatus = 'auto' | 'completed' | 'skipped';
export type StudentProgressStatus = 'not_started' | 'in_progress' | 'reviewed' | 'completed';
export type ReleaseMode = 'all_at_once' | 'sequential' | 'date_based' | 'manual' | 'prerequisites';

export type SyllabusPolicyType =
  | 'grading'
  | 'late_work'
  | 'attendance'
  | 'communication'
  | 'academic_integrity'
  | 'participation'
  | 'extra_credit'
  | 'custom';

export interface SyllabusPolicy {
  id: string;
  type: SyllabusPolicyType;
  label: string;
  content: string;
  order_index: number;
}

export interface Syllabus {
  id: string;
  classroom_id: string;
  title: string;
  summary: string | null;
  structure_type: SyllabusStructureType;
  policies: SyllabusPolicy[];
  status: SyllabusStatus;
  release_mode: ReleaseMode;
  published_at: string | null;
  accent_color: string | null;
  banner_url: string | null;
  section_label_override: string | null;
  custom_settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SyllabusSection {
  id: string;
  syllabus_id: string;
  title: string;
  description: string | null;
  content: string | null;
  order_index: number;
  start_date: string | null;
  end_date: string | null;
  objectives: string[] | null;
  resources: string | null;
  notes: string | null;
  completion_status: CompletionStatus;
  prerequisites: string[] | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface SectionResource {
  id: string;
  section_id: string;
  title: string;
  resource_type: ResourceType;
  file_path: string | null;
  url: string | null;
  mime_type: string | null;
  file_size: number | null;
  order_index: number;
  /** Module activity publish state; omit/legacy = treat as published */
  status?: ActivityResourceStatus;
  summary?: string | null;
  /** Rich text / markdown for text-type activities */
  body_text?: string | null;
  /** Ordered text + video blocks for resource_type lesson (v1); null = legacy single body_text + url */
  lesson_content?: LessonContentV1 | null;
  estimated_duration_minutes?: number | null;
  created_at: string;
  updated_at: string;
}

/** Junction: assignment ↔ module activity (section_resource) for AI context and product */
export interface AssignmentModuleActivity {
  id: string;
  assignment_id: string;
  section_resource_id: string;
  order_index: number;
  include_in_ai_context: boolean;
  created_at: string;
}

export interface StudentSectionProgress {
  id: string;
  section_id: string;
  student_id: string;
  status: StudentProgressStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GradingCategory {
  id: string;
  syllabus_id: string;
  name: string;
  weight: number;
  created_at: string;
  updated_at: string;
}

export interface SyllabusChangelog {
  id: string;
  syllabus_id: string;
  changed_by: string;
  change_summary: string;
  snapshot: Record<string, unknown> | null;
  created_at: string;
}

export interface SectionComment {
  id: string;
  section_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_avatar?: string;
  replies?: SectionComment[];
}

export interface SyllabusWithSections extends Syllabus {
  sections: SyllabusSection[];
  grading_categories: GradingCategory[];
  section_resources?: Record<string, SectionResource[]>;
}

/** Core fields required to insert a syllabus; optional columns match DB defaults used across wizard and Course Outline. */
export type CreateSyllabusInput = Pick<
  Syllabus,
  'classroom_id' | 'title' | 'summary' | 'structure_type' | 'policies' | 'status'
> &
  Partial<
    Pick<
      Syllabus,
      | 'release_mode'
      | 'published_at'
      | 'accent_color'
      | 'banner_url'
      | 'section_label_override'
      | 'custom_settings'
    >
  >;

export type UpdateSyllabusInput = Partial<Omit<Syllabus, 'id' | 'classroom_id' | 'created_at' | 'updated_at'>>;

/** Full section row on insert (timestamps generated by DB). */
export type CreateSyllabusSectionInput = Omit<SyllabusSection, 'id' | 'created_at' | 'updated_at'>;

/** One section in the wizard provisioning bundle (tempId for prerequisite wiring). */
export interface ProvisionSyllabusBundleSection {
  tempId: string;
  title: string;
  description: string | null;
  order_index: number;
  start_date: string | null;
  end_date: string | null;
  objectives: string[];
  resources: string | null;
  notes: string | null;
  content: string | null;
  completion_status: CompletionStatus;
  prerequisitesTempIds: string[];
  is_locked: boolean;
}

export type ProvisionBundleResourceItem =
  | { type: 'link'; title: string; url: string }
  | { type: 'file'; file: File; title?: string };

/** Single call: syllabus + grading categories + sections (two-phase prerequisites) + section_resources. */
export interface ProvisionSyllabusBundleInput {
  classroom_id: string;
  title: string;
  summary: string | null;
  structure_type: SyllabusStructureType;
  policies: SyllabusPolicy[];
  status: SyllabusStatus;
  release_mode: ReleaseMode;
  sections: ProvisionSyllabusBundleSection[];
  gradingCategories: { name: string; weight: number }[];
  /** Same length as sections; each list is uploaded after that section exists. */
  sectionResourceItems: ProvisionBundleResourceItem[][];
}
export type UpdateSyllabusSectionInput = Partial<Omit<SyllabusSection, 'id' | 'syllabus_id' | 'created_at' | 'updated_at'>>;
export type CreateGradingCategoryInput = Omit<GradingCategory, 'id' | 'created_at' | 'updated_at'>;
export type UpdateGradingCategoryInput = Partial<Omit<GradingCategory, 'id' | 'syllabus_id' | 'created_at' | 'updated_at'>>;
export type CreateSectionResourceInput = Omit<
  SectionResource,
  'id' | 'created_at' | 'updated_at' | 'status' | 'summary' | 'body_text' | 'estimated_duration_minutes'
> & {
  status?: ActivityResourceStatus;
  summary?: string | null;
  body_text?: string | null;
  estimated_duration_minutes?: number | null;
};
export type UpdateSectionResourceInput = Partial<Omit<SectionResource, 'id' | 'section_id' | 'created_at' | 'updated_at'>>;

export type AssignmentModuleActivityInput = {
  section_resource_id: string;
  order_index: number;
  include_in_ai_context: boolean;
};

export type ModuleFlowStepKind = 'resource' | 'assignment';

/** DB row: ordered step within a syllabus section (module). */
export interface ModuleFlowStep {
  id: string;
  section_id: string;
  order_index: number;
  step_kind: ModuleFlowStepKind;
  section_resource_id: string | null;
  assignment_id: string | null;
  created_at: string;
  updated_at: string;
}

export type StudentModuleFlowProgressStatus = 'in_progress' | 'completed';

export interface StudentModuleFlowProgress {
  id: string;
  student_id: string;
  module_flow_step_id: string;
  status: StudentModuleFlowProgressStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Section status derived from dates (or teacher override), not stored */
export type SectionStatus = 'upcoming' | 'in_progress' | 'completed' | 'skipped';

/** Data shape used by roadmap nodes */
export interface RoadmapNodeData {
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  assignmentCount: number;
  resourceCount: number;
  orderIndex: number;
  /** 1-based index within the current (possibly filtered) roadmap list */
  sectionIndex: number;
  /** Pixel width for the card (responsive) */
  nodeWidth: number;
  /** Staggered entrance delay in ms (respect reduced motion in UI) */
  enterDelayMs?: number;
  status: SectionStatus;
  sectionId: string;
  completionStatus: CompletionStatus;
  studentProgress?: StudentProgressStatus;
  locked?: boolean;
  /** True when "today" falls in the section's date range (inclusive, date-only). */
  isTodayInRange?: boolean;
}
