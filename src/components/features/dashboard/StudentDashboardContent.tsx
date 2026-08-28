import { StudentClassroomsSection } from '@/components/features/dashboard/StudentClassroomsSection';
import { StudentAssignmentsSection } from '@/components/features/dashboard/StudentAssignmentsSection';
import { StudentDashboardCalendarSidebar } from '@/components/features/dashboard/StudentDashboardCalendarSidebar';

/** Set to true to show calendar sidebar + My Assignments again on this page. */
export const STUDENT_DASHBOARD_SHOW_CALENDAR_AND_ASSIGNMENTS = false;

export function StudentDashboardContent() {
  const showAssignments = STUDENT_DASHBOARD_SHOW_CALENDAR_AND_ASSIGNMENTS;

  return (
    <div className={showAssignments ? 'grid lg:grid-cols-[1fr_380px] gap-8' : 'gap-8'}>
      <div className="space-y-8">
        <StudentClassroomsSection />
        {showAssignments ? <StudentAssignmentsSection /> : null}
      </div>
      {showAssignments ? <StudentDashboardCalendarSidebar /> : null}
    </div>
  );
}
