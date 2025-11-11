/**
 * Hard Skills Assessment Types
 * Content Related Abilities (CRA) assessment types for student hard skills
 */

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
}

export interface HardSkillAssessmentWithStudent extends HardSkillAssessment {
  student_profiles?: {
    full_name: string;
  };
}
