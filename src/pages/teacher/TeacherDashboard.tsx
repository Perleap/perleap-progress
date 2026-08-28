import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/useAuth';
import { DashboardLayout } from '@/components/layouts';
import { TeacherDashboardContent } from '@/components/features/dashboard';

const TeacherDashboard = () => {
  const { t } = useTranslation();
  const { profile, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">{t('common.loading')}</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="relative -mx-6 md:-mx-8 lg:-mx-10 -mt-6 md:-mt-8 lg:-mt-10 px-6 md:px-8 lg:px-10 pt-8 md:pt-10 lg:pt-12 pb-8 md:pb-10 mb-8 md:mb-10 overflow-hidden bg-muted/30">
        <div className="relative flex flex-col gap-4">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground truncate">
                {profile?.full_name ? `${profile.full_name}'s Dashboard` : t('teacherDashboard.title')}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm md:text-base truncate">
                {t('teacherDashboard.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <TeacherDashboardContent />
    </DashboardLayout>
  );
};

export default TeacherDashboard;
