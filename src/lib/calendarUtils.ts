import { isSameDay } from 'date-fns';

export interface ClassroomDateRange {
  id: string;
  name: string;
  subject: string;
  start_date: string | null;
  end_date: string | null;
}

/**
 * Check if a date falls within any classroom's active range
 * @param date - The date to check
 * @param classrooms - Array of classrooms with date ranges
 * @returns boolean indicating if the date is within any classroom's range
 */
export const isDateInClassRange = (date: Date, classrooms: ClassroomDateRange[]): boolean => {
  return classrooms.some((classroom) => {
    if (!classroom.start_date && !classroom.end_date) return true;

    const classStart = classroom.start_date ? new Date(classroom.start_date) : null;
    const classEnd = classroom.end_date ? new Date(classroom.end_date) : null;

    if (classStart && date < classStart) return false;
    if (classEnd && date > classEnd) return false;

    return true;
  });
};

/**
 * Get active classrooms for a specific date
 * @param date - The date to filter by
 * @param classrooms - Array of classrooms to filter
 * @returns Array of active classrooms
 */
export const getActiveClassroomsForDate = (
  date: Date,
  classrooms: ClassroomDateRange[]
): ClassroomDateRange[] => {
  return classrooms.filter((classroom) => {
    if (!classroom.start_date && !classroom.end_date) return true;

    const classStart = classroom.start_date ? new Date(classroom.start_date) : null;
    const classEnd = classroom.end_date ? new Date(classroom.end_date) : null;

    if (classStart && date < classStart) return false;
    if (classEnd && date > classEnd) return false;

    return true;
  });
};

/**
 * Filter assignments by date
 * @param date - The date to filter by
 * @param assignments - Array of assignments
 * @returns Filtered assignments
 */
export const getAssignmentsForDate = <T extends { due_at: string }>(
  date: Date,
  assignments: T[]
): T[] => {
  return assignments.filter((a) => isSameDay(new Date(a.due_at), date));
};

/**
 * Calendar modifier styles for consistent appearance
 */
export const CALENDAR_MODIFIERS_STYLES = {
  hasAssignment: {
    fontWeight: 'bold' as const,
    position: 'relative' as const,
    color: '#ef4444',
  },
  hasClass: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
} as const;
