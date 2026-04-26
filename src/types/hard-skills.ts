/**
 * Hard Skills Assessment Types
 * Content Related Abilities (CRA) assessment types for student hard skills
 */

/** Optional embed from `assignments` + `syllabus_sections` when using expanded select. */
export interface HardSkillAssignmentEmbed {
  id: string;
  title: string;
  syllabus_section_id: string | null;
  syllabus_sections?: { title: string | null; order_index?: number | null } | null;
}

export interface HardSkillAssessment {
  id: string;
  submission_id: string;
  assignment_id: string;
  student_id: string;
  domain: string;
  skill_component: string;
  current_level_percent: number;
  proficiency_description: string;
  actionable_challenge: string;
  created_at: string;
  assignments?: HardSkillAssignmentEmbed | null;
}

export interface HardSkillAssessmentWithStudent extends HardSkillAssessment {
  student_profiles?: {
    full_name: string;
  };
}
