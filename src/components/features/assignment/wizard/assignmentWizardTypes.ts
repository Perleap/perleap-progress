import type { Database } from '@/integrations/supabase/types';
import type { TestQuestionDraft } from '@/components/features/assignment/TestQuestionBuilder';

export type AssignmentWizardStepId =
  | 'basics'
  | 'format'
  | 'courseRelease'
  | 'skills'
  | 'test'
  | 'review';

export const ASSIGNMENT_WIZARD_FIRST_STEP: AssignmentWizardStepId = 'basics';

export function assignmentWizardStepOrder(assignmentType: string): AssignmentWizardStepId[] {
  const steps: AssignmentWizardStepId[] = ['basics', 'format', 'courseRelease', 'skills'];
  if (assignmentType === 'test') steps.push('test');
  steps.push('review');
  return steps;
}

export type AssignmentWizardFormData = {
  title: string;
  instructions: string;
  type: string;
  due_at: string;
  status: string;
  hard_skills: string[];
  hard_skill_domain: string;
  target_dimensions: {
    vision: boolean;
    values: boolean;
    thinking: boolean;
    connection: boolean;
    action: boolean;
  };
  personalization_flag: boolean;
  auto_publish_ai_feedback: boolean;
  materials: Array<{ type: 'pdf' | 'link'; url: string; name: string }>;
  attempt_mode: Database['public']['Enums']['assignment_attempt_mode'];
};

export function getDefaultAssignmentWizardFormData(): AssignmentWizardFormData {
  return {
    title: '',
    instructions: '',
    type: 'chatbot',
    due_at: '',
    status: 'published',
    hard_skills: [],
    hard_skill_domain: '',
    target_dimensions: {
      vision: false,
      values: false,
      thinking: false,
      connection: false,
      action: false,
    },
    personalization_flag: false,
    auto_publish_ai_feedback: true,
    materials: [],
    attempt_mode: 'single',
  };
}

export type AssignmentCreateDraftV1 = {
  formData: AssignmentWizardFormData;
  testQuestions: TestQuestionDraft[];
  syllabusSectionId: string;
  gradingCategoryId: string;
  linkedModuleActivityIds: string[];
  aiMetadata: {
    difficulty_level?: string;
    success_criteria?: string[];
    scaffolding_tips?: string;
  };
};

export function assignmentCreateDraftKey(classroomId: string, sectionId: string) {
  return `perleap:assignment-create-draft:${classroomId}:${sectionId || 'none'}`;
}

export interface AssignmentForWizardEdit {
  id: string;
  title: string;
  instructions: string;
  type: string;
  status: string;
  due_at: string | null;
  classroom_id?: string;
  attempt_mode?: Database['public']['Enums']['assignment_attempt_mode'];
}

/** Prefill when opening create from syllabus / AI flows. */
export type AssignmentWizardCreateInitialData = {
  title?: string;
  instructions?: string;
  type?: string;
  due_at?: string;
  difficulty_level?: string;
  success_criteria?: string[];
  scaffolding_tips?: string;
  target_dimensions?: AssignmentWizardFormData['target_dimensions'];
  syllabus_section_id?: string;
  grading_category_id?: string;
};
