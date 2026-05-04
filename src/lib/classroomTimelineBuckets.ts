/**
 * Same date rules as {@link ClassroomTimelineView} buckets (active / upcoming / completed).
 * Used to prioritize dashboard prefetch in on-screen section order.
 */
export function partitionEnrolledClassroomsByTimelineTier<
  T extends { id: string; start_date?: string | null; end_date?: string | null },
>(classrooms: T[]): { active: string[]; upcoming: string[]; completed: string[] } {
  const now = new Date();
  const active: string[] = [];
  const upcoming: string[] = [];
  const completed: string[] = [];

  for (const c of classrooms) {
    const startDate = c.start_date ? new Date(c.start_date) : null;
    const endDate = c.end_date ? new Date(c.end_date) : null;

    let status: 'upcoming' | 'active' | 'completed' = 'active';

    if (startDate && endDate) {
      if (now < startDate) {
        status = 'upcoming';
      } else if (now > endDate) {
        status = 'completed';
      } else {
        status = 'active';
      }
    } else if (startDate && now < startDate) {
      status = 'upcoming';
    } else if (endDate && now > endDate) {
      status = 'completed';
    }

    if (status === 'active') active.push(c.id);
    else if (status === 'upcoming') upcoming.push(c.id);
    else completed.push(c.id);
  }

  return { active, upcoming, completed };
}
