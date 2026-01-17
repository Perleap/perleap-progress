import { Info, BookOpen, Users, FileText, BarChart3 } from 'lucide-react';
import React from 'react';

export interface ClassroomSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Pre-defined sections for teacher classroom
export const TEACHER_CLASSROOM_SECTIONS: ClassroomSection[] = [
  { id: 'overview', title: 'Overview', icon: Info },
  { id: 'assignments', title: 'Assignments', icon: BookOpen },
  { id: 'students', title: 'Students', icon: Users },
  { id: 'submissions', title: 'Submissions', icon: FileText },
  { id: 'analytics', title: 'Analytics', icon: BarChart3 },
];

// Pre-defined sections for student classroom
export const STUDENT_CLASSROOM_SECTIONS: ClassroomSection[] = [
  { id: 'overview', title: 'Overview', icon: Info },
  { id: 'assignments', title: 'Assignments', icon: BookOpen },
];
