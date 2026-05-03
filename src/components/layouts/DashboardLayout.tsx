import type { ReactNode } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { usePageTransition } from '@/hooks/useGsapAnimations';
import { useLanguage } from '@/contexts/LanguageContext';

import { useAuth } from '@/contexts/useAuth';
import { useTranslation } from 'react-i18next';
import { USER_ROLES } from '@/config/constants';
import { FloatingShellActions } from './FloatingShellActions';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const contentRef = usePageTransition();
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.user_metadata?.role === USER_ROLES.ADMIN;
  const isTeacher =
    user?.user_metadata?.role === 'teacher' || user?.user_metadata?.role === 'admin';

  return (
    <SidebarProvider defaultOpen={true} className={isRTL ? 'rtl-sidebar' : ''}>
      <AppSidebar />
      <SidebarInset className="relative z-0">
        <FloatingShellActions userId={user?.id} showTeacherAssistant={isTeacher} />
        <div
          ref={contentRef}
          className="flex flex-1 flex-col gap-10 pt-14 sm:pt-16 md:pt-[4.5rem] p-3 sm:p-4 md:p-5 bg-gradient-to-br from-background via-background to-muted/5 min-h-0"
        >
          {isAdmin && (
            <div
              role="status"
              className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100"
            >
              {t('admin.modeBanner')}
            </div>
          )}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
