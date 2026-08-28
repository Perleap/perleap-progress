import type { StudentDashboardAssignment } from '@/types/api.types';
import type { TeacherProfilesMap } from '@/hooks/useTeacherProfilesMap';

type RawSubmission = {
  status?: string;
  assignment_feedback?: unknown[];
};

export function isAssignmentCompleted(
  submissions: RawSubmission[] | null | undefined,
): boolean {
  return (
    submissions?.some(
      (s) =>
        s.status === 'completed' ||
        (Array.isArray(s.assignment_feedback) && s.assignment_feedback.length > 0),
    ) ?? false
  );
}

export function mapStudentDashboardAssignments(
  raw: unknown[],
  teacherProfiles: TeacherProfilesMap,
): StudentDashboardAssignment[] {
  return raw.map((item) => {
    const a = item as Record<string, unknown>;
    const classrooms = a.classrooms as StudentDashboardAssignment['classrooms'];
    const teacherId = classrooms?.teacher_id;
    return {
      ...(a as Omit<StudentDashboardAssignment, 'is_completed' | 'classrooms'>),
      classrooms: {
        ...classrooms,
        teacher_profiles: (teacherId && teacherProfiles[teacherId]) || null,
      },
      is_completed: isAssignmentCompleted(
        a.submissions as RawSubmission[] | undefined,
      ),
    };
  });
}

export type AssignmentSortKey = 'recent' | 'oldest' | 'due-date';

export function sortStudentDashboardAssignments(
  assignments: StudentDashboardAssignment[],
  sortBy: AssignmentSortKey,
): StudentDashboardAssignment[] {
  const sorted = [...assignments];
  switch (sortBy) {
    case 'recent':
      return sorted.reverse();
    case 'oldest':
      return sorted;
    case 'due-date':
      return sorted.sort(
        (a, b) => new Date(a.due_at ?? 0).getTime() - new Date(b.due_at ?? 0).getTime(),
      );
    default:
      return sorted;
  }
}
