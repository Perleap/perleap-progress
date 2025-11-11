/**
 * Dashboard Header Component
 * Header for dashboard pages with profile and actions
 */

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

interface DashboardHeaderProps {
  title: string;
  avatarUrl: string | null;
  initials: string;
  onProfileClick: () => void;
  additionalActions?: ReactNode;
}

/**
 * Display dashboard header with profile and sign out
 */
export const DashboardHeader = ({
  title,
  avatarUrl,
  initials,
  onProfileClick,
  additionalActions,
}: DashboardHeaderProps) => {
  const { signOut } = useAuth();

  return (
    <header className="border-b">
      <div className="container flex h-14 md:h-16 items-center justify-between px-4">
        <h1 className="text-lg md:text-2xl font-bold">{title}</h1>
        <div className="flex items-center gap-2">
          {additionalActions}
          <ThemeToggle />
          <LanguageSwitcher />
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
          <ProfileAvatar
            avatarUrl={avatarUrl}
            initials={initials}
            onClick={onProfileClick}
            className="h-12 w-12"
          />
        </div>
      </div>
    </header>
  );
};

