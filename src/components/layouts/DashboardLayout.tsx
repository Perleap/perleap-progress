import * as React from 'react';
import { useRef, useEffect } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { usePageTransition } from '@/hooks/useGsapAnimations';
import { useLanguage } from '@/contexts/LanguageContext';
import { TeacherAssistant } from '@/components/ai/TeacherAssistant';
import { NotificationDropdown } from '@/components/common/NotificationDropdown';
import { useAuth } from '@/contexts/AuthContext';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  title?: string;
}

export function DashboardLayout({ children, breadcrumbs = [], title }: DashboardLayoutProps) {
  const contentRef = usePageTransition();
  const { isRTL } = useLanguage();
  const { user } = useAuth();

  return (
    <SidebarProvider defaultOpen={true} className={isRTL ? 'rtl-sidebar' : ''}>
      <AppSidebar />
      <SidebarInset className="relative z-0">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border/40 bg-gradient-to-r from-background via-background/95 to-background backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 px-6 shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-4 flex-1">
            <SidebarTrigger className="hover:bg-accent hover:scale-110 rounded-lg p-2.5 transition-all duration-200 shadow-sm hover:shadow-md border border-transparent hover:border-accent-foreground/10" />
            <Separator orientation="vertical" className="h-6 bg-border/60" />
            {breadcrumbs.length > 0 && (
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbs.map((item, index) => (
                    <React.Fragment key={index}>
                      <BreadcrumbItem className={index === breadcrumbs.length - 1 ? '' : 'hidden md:block'}>
                        {item.href ? (
                          <BreadcrumbLink href={item.href} className="font-medium hover:text-primary transition-colors">
                            {item.label}
                          </BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage className="font-semibold text-foreground">{item.label}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                      {index < breadcrumbs.length - 1 && (
                        <BreadcrumbSeparator className="hidden md:block" />
                      )}
                    </React.Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <NotificationDropdown userId={user.id} />
            </div>
          )}
        </header>
        <div ref={contentRef} className="flex flex-1 flex-col gap-10 p-6 md:p-8 lg:p-10 bg-gradient-to-br from-background via-background to-muted/5 min-h-0">
          {children}
        </div>
        <TeacherAssistant />
      </SidebarInset>
    </SidebarProvider>
  );
}



