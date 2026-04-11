/**
 * Syllabus Types
 * TypeScript interfaces for syllabus-related entities
 */

export type SyllabusStructureType = 'weeks' | 'units' | 'modules';
export type SyllabusStatus = 'draft' | 'published' | 'archived';

export interface Syllabus {
  id: string;
  classroom_id: string;
  title: string;
  summary: string | null;
  structure_type: SyllabusStructureType;
  grading_policy_text: string | null;
  attendance_policy_text: string | null;
  late_work_policy_text: string | null;
  communication_policy_text: string | null;
  status: SyllabusStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyllabusSection {
  id: string;
  syllabus_id: string;
  title: string;
  description: string | null;
  order_index: number;
  start_date: string | null;
  end_date: string | null;
  objectives: string[] | null;
  resources: string | null;
  notes: string | null;
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

export interface SyllabusWithSections extends Syllabus {
  sections: SyllabusSection[];
  grading_categories: GradingCategory[];
}

export type CreateSyllabusInput = Omit<Syllabus, 'id' | 'created_at' | 'updated_at' | 'published_at'>;
export type UpdateSyllabusInput = Partial<Omit<Syllabus, 'id' | 'classroom_id' | 'created_at' | 'updated_at'>>;
export type CreateSyllabusSectionInput = Omit<SyllabusSection, 'id' | 'created_at' | 'updated_at'>;
export type UpdateSyllabusSectionInput = Partial<Omit<SyllabusSection, 'id' | 'syllabus_id' | 'created_at' | 'updated_at'>>;
export type CreateGradingCategoryInput = Omit<GradingCategory, 'id' | 'created_at' | 'updated_at'>;
export type UpdateGradingCategoryInput = Partial<Omit<GradingCategory, 'id' | 'syllabus_id' | 'created_at' | 'updated_at'>>;

/** Section status derived from dates, not stored */
export type SectionStatus = 'upcoming' | 'in_progress' | 'completed';

/** Data shape used by roadmap nodes */
export interface RoadmapNodeData {
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  assignmentCount: number;
  orderIndex: number;
  status: SectionStatus;
  sectionId: string;
}
