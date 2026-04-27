import type { ReactNode } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { usePageTransition } from '@/hooks/useGsapAnimations';
import { useLanguage } from '@/contexts/LanguageContext';

import { NotificationDropdown } from '@/components/common/NotificationDropdown';
import { useAuth } from '@/contexts/useAuth';
import { TeacherAssistantTrigger } from '@/components/ai/TeacherAssistant';
import { useTranslation } from 'react-i18next';
import { USER_ROLES } from '@/config/constants';

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
        <header className="flex min-h-24 shrink-0 items-center gap-4 border-b border-border/40 bg-gradient-to-r from-background via-background/95 to-background px-4 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 md:px-5 sticky top-0 z-30">
          <div className="flex flex-1 items-center gap-4">
            <SidebarTrigger className="rounded-lg border border-transparent p-2.5 shadow-sm transition-all duration-200 hover:scale-110 hover:border-accent-foreground/10 hover:bg-accent hover:shadow-md" />
            <Separator orientation="vertical" className="h-8 bg-border/60" />
            <div className="min-w-0 flex-1" aria-hidden />
          </div>
          {user && (
            <div className="flex items-center gap-2">
              {isTeacher && <TeacherAssistantTrigger />}
              <NotificationDropdown userId={user.id} />
            </div>
          )}
        </header>
        <div
          ref={contentRef}
          className="flex flex-1 flex-col gap-10 pt-5 sm:pt-7 md:pt-8 p-3 sm:p-4 md:p-5 bg-gradient-to-br from-background via-background to-muted/5 min-h-0"
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


