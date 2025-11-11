/**
 * Submission and Feedback Type Definitions
 */

/**
 * Assignment submission
 */
export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  text_body: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Submission with assignment details
 */
export interface SubmissionWithAssignment extends Submission {
  assignments: {
    id: string;
    title: string;
    instructions: string;
    due_at: string;
    type: string;
    classrooms: {
      name: string;
      subject: string;
    };
  };
}

/**
 * Feedback for a submission
 */
export interface Feedback {
  id: string;
  submission_id: string;
  student_feedback: string;
  teacher_feedback: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Five-dimensional scores
 */
export interface FiveDScores {
  vision: number;
  values: number;
  thinking: number;
  connection: number;
  action: number;
}

/**
 * Complete feedback with scores
 */
export interface FeedbackWithScores extends Feedback {
  fived_scores: FiveDScores | null;
  hard_skills_assessment: HardSkillsAssessment | null;
}

/**
 * Hard skills assessment
 */
export interface HardSkillsAssessment {
  skill_name: string;
  proficiency_level: number;
  feedback: string;
  [key: string]: string | number;
}

/**
 * Submission status
 */
export type SubmissionStatus = 'draft' | 'submitted' | 'pending' | 'graded' | 'returned';

/**
 * Submission with student details
 */
export interface SubmissionWithDetails extends Submission {
  assignments?: {
    title: string;
    due_at: string;
    type: string;
    instructions: string;
  };
  student_profiles?: {
    full_name: string;
    avatar_url?: string;
  };
}

/**
 * Hard skill assessment item
 */
export interface HardSkill {
  name: string;
  score: number;
  feedback: string;
}
