import { USER_ROLES } from '@/config/constants';
import { useAuth } from '@/contexts/useAuth';
import { TeacherCalendar } from '@/components/TeacherCalendar';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { TeacherClassroomsSection } from '@/components/features/dashboard/TeacherClassroomsSection';

export function TeacherDashboardContent() {
  const { user } = useAuth();
  const isAppAdmin = user?.user_metadata?.role === USER_ROLES.ADMIN;

  return (
    <div className="grid lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_420px] gap-6 md:gap-8 xl:gap-10">
      <TeacherClassroomsSection />
      <aside className="space-y-6 md:space-y-8">
        {user && (
          <div className="lg:sticky lg:top-6 space-y-6">
            <RecentActivity />
            <TeacherCalendar teacherId={user.id} isAppAdmin={isAppAdmin} />
          </div>
        )}
      </aside>
    </div>
  );
}
