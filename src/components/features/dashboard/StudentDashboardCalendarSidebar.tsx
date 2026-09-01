import { StudentCalendar } from '@/components/features/dashboard/StudentCalendar';
import { useAuth } from '@/contexts/useAuth';

export const StudentDashboardCalendarSidebar = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="lg:col-span-1">
      <div className="sticky top-24">
        <StudentCalendar studentId={user.id} />
      </div>
    </div>
  );
};
