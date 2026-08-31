import { useTranslation } from 'react-i18next';
import { TeacherDashboardContent, TeacherDashboardHero } from '@/components/features/dashboard';
import { DashboardLayout } from '@/components/layouts';
import { useAuth } from '@/contexts/useAuth';

const TeacherDashboard = () => {
  const { t } = useTranslation();
  const { loading: authLoading } = useAuth();

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
      <TeacherDashboardHero />
      <TeacherDashboardContent />
    </DashboardLayout>
  );
};

export default TeacherDashboard;
