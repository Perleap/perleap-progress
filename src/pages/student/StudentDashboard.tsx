import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layouts';
import { StudentDashboardContent } from '@/components/features/dashboard';

const StudentDashboard = () => {
  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('studentDashboard.title')}</h1>
        <p className="text-muted-foreground">{t('studentDashboard.subtitle')}</p>
      </div>

      <StudentDashboardContent />
    </DashboardLayout>
  );
};

export default StudentDashboard;
