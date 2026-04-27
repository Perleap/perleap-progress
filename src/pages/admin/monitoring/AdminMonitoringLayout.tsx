import { Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts';
import { useAuth } from '@/contexts/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { USER_ROLES } from '@/config/constants';

export default function AdminMonitoringLayout() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  const dbAdminQuery = useQuery({
    queryKey: ['is_app_admin_db', user?.id],
    enabled: !loading && !!user?.id && user.user_metadata?.role === USER_ROLES.ADMIN,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_app_admin', { _user_id: user!.id });
      if (error) throw error;
      return data === true;
    },
  });

  if (!loading && user?.user_metadata?.role !== USER_ROLES.ADMIN) {
    return <Navigate to="/teacher/dashboard" replace />;
  }

  if (!loading && dbAdminQuery.isSuccess && dbAdminQuery.data === false) {
    return <Navigate to="/teacher/dashboard" replace />;
  }

  if (loading || (user?.user_metadata?.role === USER_ROLES.ADMIN && dbAdminQuery.isLoading)) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">{t('common.loading')}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6" data-monitoring-layout>
        <Outlet />
      </div>
    </DashboardLayout>
  );
}
