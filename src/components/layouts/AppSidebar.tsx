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
    <Sidebar collapsible="icon">
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
                    className={`min-h-[48px] transition-all duration-200 group-data-[collapsible=icon]:justify-center ${item.isActive ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
                  >
                    <item.icon className="size-5" />
                    <span className="font-medium text-base group-data-[collapsible=icon]:hidden">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-2 py-4">
        <SidebarMenu className="space-y-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              className="min-h-[48px] transition-all duration-200 group-data-[collapsible=icon]:justify-center"
            >
              {theme === 'dark' ? (
                <Sun className="size-5" />
              ) : (
                <Moon className="size-5" />
              )}
              <span className="font-medium text-base group-data-[collapsible=icon]:hidden">{theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-h-[48px] transition-all duration-200 group-data-[collapsible=icon]:justify-center"
              tooltip={t('nav.signOut')}
            >
              <LogOut className="size-5" />
              <span className="font-medium text-base group-data-[collapsible=icon]:hidden">{t('nav.signOut')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}


