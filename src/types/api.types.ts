/**
 * API Types
 * Request and response types for API calls
 */

import type {
  Assignment,
  Classroom,
  FiveDScores,
  Message,
  Submission,
  TeacherProfile,
  StudentProfile,
} from './models';

// Classroom API Types
export interface ClassroomWithEnrollmentCount extends Classroom {
  _count?: { enrollments: number };
}

export interface ClassroomWithTeacher extends Classroom {
  teacher_profiles: TeacherProfile | null;
}

// Assignment API Types
export interface AssignmentWithClassroom extends Assignment {
  classrooms: {
    name: string;
    teacher_id?: string;
    teacher_profiles?: TeacherProfile | null;
  };
}

export interface CreateAssignmentInput {
  classroom_id: string;
  title: string;
  instructions: string;
  type: Assignment['type'];
  due_at: string | null;
  status: Assignment['status'];
  target_dimensions: Assignment['target_dimensions'];
  personalization_flag: boolean;
}

export interface UpdateAssignmentInput extends Partial<CreateAssignmentInput> {
  id: string;
}

// Submission API Types
export interface SubmissionWithDetails extends Submission {
  assignments: {
    title: string;
  };
  student_profiles: StudentProfile | null;
  assignment_feedback: Array<{
    student_feedback: string;
    teacher_feedback: string | null;
    created_at: string;
  }>;
}

// Chat API Types
export interface ChatRequest {
  message: string;
  assignmentInstructions: string;
  submissionId: string;
  studentId: string;
  assignmentId: string;
  isInitialGreeting?: boolean;
  language?: string;
}

export interface ChatResponse {
  message: string;
  turnCount?: number;
  shouldEnd?: boolean;
  endReason?: string;
}

// Feedback API Types
export interface FeedbackRequest {
  submissionId: string;
  studentId: string;
  assignmentId: string;
  language?: string;
}

export interface FeedbackResponse {
  studentFeedback: string;
  teacherFeedback: string | null;
}

// Analytics Types
export interface StudentAnalytics {
  id: string;
  fullName: string;
  latestScores: FiveDScores | null;
  feedbackCount: number;
}

export interface ClassroomAnalytics {
  studentCount: number;
  assignmentCount: number;
  totalSubmissions: number;
  completionRate: number;
  classAverage: FiveDScores | null;
  students: StudentAnalytics[];
}

// Error Types
export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}
