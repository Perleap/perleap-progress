import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  User,
  Moon,
  Sun,
  Bell,
  MessageSquare,
  Calendar,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isRTL } = useLanguage();

  const isTeacher = user?.user_metadata?.role === 'teacher';
  const basePath = isTeacher ? '/teacher' : '/student';
  const isOnSettingsPage = location.pathname.includes('/settings');

  // Define navigation items based on role
  const navItems: NavItem[] = React.useMemo(() => {
    const items: NavItem[] = [
      {
        title: t('nav.dashboard'),
        url: `${basePath}/dashboard`,
        icon: LayoutDashboard,
      },
    ];

    if (isTeacher) {
      items.push({
        title: 'Planner',
        url: '/teacher/planner',
        icon: Calendar,
      });

    }

    // Removed generic Settings link in favor of detailed account items
    // items.push({
    //   title: t('nav.settings'),
    //   url: isTeacher ? '/teacher/settings' : '/student/settings',
    //   icon: Settings,
    // });


    return items;
  }, [t, basePath, isTeacher]);

  const accountItems: NavItem[] = React.useMemo(() => {
    const items: NavItem[] = [
      {
        title: t('settings.profile'),
        url: `${basePath}/settings?tab=profile`,
        icon: User,
      },
      {
        title: t('common.notifications'),
        url: `${basePath}/settings?tab=notifications`,
        icon: Bell,
      },
    ];

    if (isTeacher) {
      items.splice(1, 0, {
        title: t('settings.teachingPreferences'),
        url: '/teacher/settings?tab=questions', // Using questions tab for preferences
        icon: MessageSquare,
      });
    } else {
      items.splice(1, 0, {
        title: t('settings.learningPreferences'),
        url: '/student/settings?tab=questions',
        icon: MessageSquare,
      });
    }

    return items;
  }, [t, basePath, isTeacher]);

  // Mark active item
  const navItemsWithActive = navItems.map((item) => ({
    ...item,
    isActive: location.pathname === item.url || (location.pathname !== '/' && location.pathname.startsWith(item.url) && item.url !== `${basePath}/dashboard`),
  }));

  const accountItemsWithActive = accountItems.map((item) => {
    // Check if base URL matches AND query param matches
    const currentUrl = location.pathname + location.search;
    // Simple check: if path matches and tab param matches (or defaults)
    const itemUrl = new URL(item.url, 'http://localhost'); // dummy host for parsing
    const itemPath = itemUrl.pathname;
    const itemTab = itemUrl.searchParams.get('tab');

    const currentTab = new URLSearchParams(location.search).get('tab') || 'profile';

    return {
      ...item,
      isActive: location.pathname === itemPath && currentTab === itemTab,
    };
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const userInitials = React.useMemo(() => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'U';
  }, [profile?.full_name]);

  return (
    <Sidebar collapsible="icon" side={isRTL ? "right" : "left"}>
      <SidebarHeader className="border-b border-sidebar-border h-16 flex items-center px-5 group-data-[collapsible=icon]:px-2">
        <SidebarMenu>
          <SidebarMenuItem className="list-none">
            <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
              <div className="flex aspect-square size-10 items-center justify-center rounded-xl bg-card border border-border shadow-sm group-data-[collapsible=icon]:size-8">
                <img
                  src="/perleap_logo.png"
                  alt="PerLeap Logo"
                  className="size-7 object-contain group-data-[collapsible=icon]:size-6"
                  onError={(e) => {
                    console.error('Logo failed to load');
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-bold text-xl">PerLeap</span>
                <span className="truncate text-base text-muted-foreground font-semibold">
                  {isTeacher ? t('nav.teacherPortal') : t('nav.studentPortal')}
                </span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {t('nav.menu')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItemsWithActive.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={item.isActive}
                    tooltip={item.title}
                    className={`min-h-[48px] transition-all duration-200 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg ${item.isActive ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
                  >
                    <item.icon className="size-5 group-data-[collapsible=icon]:size-5" />
                    <span className="font-medium text-base group-data-[collapsible=icon]:hidden">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Settings button */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate(`${basePath}/settings`)}
                  isActive={isOnSettingsPage}
                  tooltip={t('nav.settings')}
                  className={`min-h-[48px] transition-all duration-200 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg ${isOnSettingsPage ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
                >
                  <Settings className="size-5 group-data-[collapsible=icon]:size-5" />
                  <span className="font-medium text-base group-data-[collapsible=icon]:hidden">{t('nav.settings')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings sub-items - only show when on settings page */}
        {isOnSettingsPage && (
          <>
            <SidebarSeparator className="my-2" />
            <SidebarGroup>
              <SidebarGroupLabel className="px-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {t('nav.settings')}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {accountItemsWithActive.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => navigate(item.url)}
                        isActive={item.isActive}
                        className="cursor-pointer min-h-[40px]"
                      >
                        <item.icon className="size-4" />
                        <span className="font-normal text-sm">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-2 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || ''} />
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{profile?.full_name || t('nav.user')}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {isTeacher ? t('nav.teacher') : t('nav.student')}
                    </span>
                  </div>
                  <ChevronDown className={`${isRTL ? 'mr-auto' : 'ml-auto'} size-4`} />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="top"
                align={isRTL ? "start" : "end"}
                sideOffset={4}
              >
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === 'dark' ? (
                    <Sun className={`${isRTL ? 'ml-2' : 'mr-2'} size-4`} />
                  ) : (
                    <Moon className={`${isRTL ? 'ml-2' : 'mr-2'} size-4`} />
                  )}
                  {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
                </DropdownMenuItem>
                <div className="px-2 py-1.5">
                  <LanguageSwitcher />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className={`${isRTL ? 'ml-2' : 'mr-2'} size-4`} />
                  {t('nav.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}


