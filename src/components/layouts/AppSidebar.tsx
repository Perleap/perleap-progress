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
  ChevronUp,
  User2,
  Moon,
  Sun,
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

export function AppSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isRTL } = useLanguage();

  const isTeacher = user?.user_metadata?.role === 'teacher';
  const basePath = isTeacher ? '/teacher' : '/student';

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
        title: t('nav.settings'),
        url: '/teacher/settings',
        icon: Settings,
      });
    } else {
      items.push({
        title: t('nav.settings'),
        url: '/student/settings',
        icon: Settings,
      });
    }

    return items;
  }, [t, basePath, isTeacher]);

  // Mark active item
  const navItemsWithActive = navItems.map((item) => ({
    ...item,
    isActive: location.pathname === item.url || location.pathname.startsWith(item.url + '/'),
  }));

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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
                  <ChevronUp className={`${isRTL ? 'mr-auto' : 'ml-auto'} size-4`} />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="top"
                align={isRTL ? "start" : "end"}
                sideOffset={4}
              >
                <DropdownMenuItem onClick={() => navigate(`${basePath}/settings`)}>
                  <User2 className={`${isRTL ? 'ml-2' : 'mr-2'} size-4`} />
                  {t('nav.profile')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === 'dark' ? (
                    <Sun className={`${isRTL ? 'ml-2' : 'mr-2'} size-4`} />
                  ) : (
                    <Moon className={`${isRTL ? 'ml-2' : 'mr-2'} size-4`} />
                  )}
                  {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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


