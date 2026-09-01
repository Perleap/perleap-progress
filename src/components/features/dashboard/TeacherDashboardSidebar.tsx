import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { TeacherCalendar } from '@/components/features/dashboard/TeacherCalendar';
import { USER_ROLES } from '@/config/constants';
import { useAuth } from '@/contexts/useAuth';

export const TeacherDashboardSidebar = () => {
  const { user } = useAuth();
  const isAppAdmin = user?.user_metadata?.role === USER_ROLES.ADMIN;

  if (!user) return null;

  return (
    <aside className="space-y-6 md:space-y-8">
      <div className="lg:sticky lg:top-6 space-y-6">
        <RecentActivity />
        <TeacherCalendar teacherId={user.id} isAppAdmin={isAppAdmin} />
      </div>
    </aside>
  );
};
