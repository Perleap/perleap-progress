/**
 * Submission and feedback helpers (domain types live in ./models and ./api.types).
 */

import type { FiveDScores, Submission } from './models';

/** Passed to parent after successful submit so the student sees the right completion modal copy. */
export type AssignmentCompletionTone =
  | 'activityCompleted'
  | 'awaitingTeacher'
  | 'awaitingReview'
  | 'testSubmitted';

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
 * Hard skill assessment item
 */
export interface HardSkill {
  name: string;
  score: number;
  feedback: string;
}
