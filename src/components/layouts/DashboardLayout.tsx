import * as React from 'react';
import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

import { NotificationDropdown } from '@/components/common/NotificationDropdown';
import { useAuth } from '@/contexts/useAuth';
import { TeacherAssistantTrigger } from '@/components/ai/TeacherAssistant';

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
  const isTeacher = user?.user_metadata?.role === 'teacher';

  return (
    <SidebarProvider defaultOpen={true} className={isRTL ? 'rtl-sidebar' : ''}>
      <AppSidebar />
      <SidebarInset className="relative z-0">
        <header className="flex min-h-24 shrink-0 items-center gap-4 border-b border-border/40 bg-gradient-to-r from-background via-background/95 to-background px-4 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 md:px-5 sticky top-0 z-30">
          <div className="flex flex-1 items-center gap-4">
            <SidebarTrigger className="rounded-lg border border-transparent p-2.5 shadow-sm transition-all duration-200 hover:scale-110 hover:border-accent-foreground/10 hover:bg-accent hover:shadow-md" />
            <Separator orientation="vertical" className="h-8 bg-border/60" />
            {breadcrumbs.length > 0 && (
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbs.map((item, index) => (
                    <React.Fragment key={index}>
                      <BreadcrumbItem className={index === breadcrumbs.length - 1 ? '' : 'hidden md:block'}>
                        {item.href ? (
                          <BreadcrumbLink render={<Link to={item.href} />} className="font-medium hover:text-primary transition-colors">
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
              {isTeacher && <TeacherAssistantTrigger />}
              <NotificationDropdown userId={user.id} />
            </div>
          )}
        </header>
        <div
          ref={contentRef}
          className="flex flex-1 flex-col gap-10 pt-5 sm:pt-7 md:pt-8 p-3 sm:p-4 md:p-5 bg-gradient-to-br from-background via-background to-muted/5 min-h-0"
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}



