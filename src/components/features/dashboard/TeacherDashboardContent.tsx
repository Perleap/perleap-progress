import { TeacherClassroomsSection } from '@/components/features/dashboard/TeacherClassroomsSection';
import { TeacherDashboardSidebar } from '@/components/features/dashboard/TeacherDashboardSidebar';

export const TeacherDashboardContent = () => {
  return (
    <div className="grid lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_420px] gap-6 md:gap-8 xl:gap-10">
      <TeacherClassroomsSection />
      <TeacherDashboardSidebar />
    </div>
  );
};
