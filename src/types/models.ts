/**
 * Domain Models
 * TypeScript interfaces for core application entities
 */

export interface User {
  id: string;
  email: string;
  role: 'teacher' | 'student';
  created_at: string;
}

export interface TeacherProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface StudentProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar_url: string | null;
  voice_preference: string;
  created_at: string;
}

export interface Domain {
  name: string;
  components: string[];
}

export interface CourseMaterial {
  type: 'pdf' | 'link';
  url: string;
  name: string;
}

export interface Classroom {
  id: string;
  name: string;
  subject: string;
  invite_code: string;
  teacher_id: string;
  course_title: string | null;
  course_duration: string | null;
  start_date: string | null;
  end_date: string | null;
  course_outline: string | null;
  resources: string | null;
  learning_outcomes: string[] | null;
  key_challenges: string[] | null;
  domains: Domain[] | null;
  materials: CourseMaterial[] | null;
  created_at: string;
  _count?: {
    enrollments: number;
  };
}

export interface Assignment {
  id: string;
  classroom_id: string;
  title: string;
  instructions: string;
  type: 'text_essay' | 'file_upload' | 'quiz' | 'project';
  status: 'draft' | 'published';
  due_at: string | null;
  target_dimensions: TargetDimensions;
  personalization_flag: boolean;
  materials?: CourseMaterial[] | null;
  hard_skills?: string[] | null;
  hard_skill_domain?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TargetDimensions {
  vision: boolean;
  values: boolean;
  thinking: boolean;
  connection: boolean;
  action: boolean;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  text_body: string | null;
  file_urls: string[] | null;
  status: 'in_progress' | 'completed';
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignmentFeedback {
  id: string;
  submission_id: string;
  student_id: string;
  assignment_id: string;
  student_feedback: string;
  teacher_feedback: string | null;
  conversation_context: Message[];
  created_at: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssignmentConversation {
  id: string;
  submission_id: string;
  student_id: string;
  assignment_id: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export interface FiveDScores {
  vision: number;
  values: number;
  thinking: number;
  connection: number;
  action: number;
}

export interface FiveDSnapshot {
  id: string;
  user_id: string;
  scores: FiveDScores;
  source: 'onboarding' | 'assignment';
  submission_id: string | null;
  classroom_id: string | null;
  score_explanations?: {
    vision?: string;
    values?: string;
    thinking?: string;
    connection?: string;
    action?: string;
  } | null;
  created_at: string;
}

export interface Enrollment {
  id: string;
  classroom_id: string;
  student_id: string;
  created_at: string;
}

export interface EnrolledStudent extends Enrollment {
  student_profiles: StudentProfile | null;
}
