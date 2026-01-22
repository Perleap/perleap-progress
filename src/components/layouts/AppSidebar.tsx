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
  ChevronRight,
  User,
  Moon,
  Sun,
  Bell,
  MessageSquare,
  Calendar,
  Globe,
  Volume2,
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
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
  const { language = 'en', setLanguage, isRTL } = useLanguage();

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
        title: t('nav.planner'),
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
      items.splice(2, 0, {
        title: t('settings.voicePreference'),
        url: `${basePath}/settings?tab=preferences`,
        icon: Volume2,
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
              <div className={`grid flex-1 ${isRTL ? 'text-right' : 'text-left'} leading-tight group-data-[collapsible=icon]:hidden`}>
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
        {/* MENU Section */}
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

        <SidebarSeparator className="my-2" />

        {/* SETTINGS Section - Visible only on settings page */}
        {isOnSettingsPage && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t('nav.settings')}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {/* All Settings Items */}
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
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-2 py-4">
        <SidebarMenu className="space-y-1">
          {/* Theme Toggle */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              className="min-h-[40px] group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg"
            >
              {theme === 'dark' ? (
                <Sun className="size-5 group-data-[collapsible=icon]:size-5" />
              ) : (
                <Moon className="size-5 group-data-[collapsible=icon]:size-5" />
              )}
              <span className="font-medium text-base group-data-[collapsible=icon]:hidden">
                {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Language - Dropdown */}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  tooltip="Language"
                  className="min-h-[40px] group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg cursor-pointer hover:bg-sidebar-accent/50 transition-colors"
                >
                  <Globe className="size-5 group-data-[collapsible=icon]:size-5 opacity-70" />
                  <span className={`font-semibold text-sm group-data-[collapsible=icon]:hidden flex-1 ${isRTL ? 'text-right mr-1' : 'text-left ml-1'}`}>
                    {language === 'en' ? 'English' : 'עברית'}
                  </span>
                  <ChevronDown className={`${isRTL ? 'mr-auto' : 'ml-auto'} size-4 opacity-50 group-data-[collapsible=icon]:hidden`} />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="end"
                dir={isRTL ? 'rtl' : 'ltr'}
                className="w-[--radix-dropdown-menu-trigger-width] min-w-[160px] rounded-xl p-1 shadow-lg border border-border/50"
              >
                <DropdownMenuItem
                  onClick={() => setLanguage('en')}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    language === 'en' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-accent'
                  }`}
                >
                  <span className="text-lg leading-none">🇺🇸</span>
                  <span>English</span>
                  {language === 'en' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLanguage('he')}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    language === 'he' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-accent'
                  }`}
                >
                  <span className="text-lg leading-none">🇮🇱</span>
                  <span>עברית</span>
                  {language === 'he' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>

          <SidebarSeparator className="my-2" />

          {/* Profile - Dropdown Menu */}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg"
                >
                  <Avatar className="h-8 w-8 rounded-lg group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || ''} />
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`grid flex-1 ${isRTL ? 'text-right' : 'text-left'} text-sm leading-tight group-data-[collapsible=icon]:hidden`}>
                    <span className="truncate font-semibold">{profile?.full_name || t('nav.user')}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {isTeacher ? t('nav.teacher') : t('nav.student')}
                    </span>
                  </div>
                  <ChevronDown className={`${isRTL ? 'mr-auto' : 'ml-auto'} size-4 group-data-[collapsible=icon]:hidden`} />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align={isRTL ? "start" : "end"}
                sideOffset={8}
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                  <LogOut className={`${isRTL ? 'ml-2' : 'mr-2'} size-4`} />
                  {t('nav.logout')}
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


