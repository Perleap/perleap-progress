/**
 * Profile Avatar Component
 * Reusable avatar component with fallback initials
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface ProfileAvatarProps {
  avatarUrl: string | null;
  initials: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Display user avatar with fallback to initials
 */
export const ProfileAvatar = ({
  avatarUrl,
  initials,
  onClick,
  className = 'h-12 w-12',
}: ProfileAvatarProps) => {
  if (onClick) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={`relative ${className} rounded-full p-0`}
        onClick={onClick}
      >
        <Avatar className={`${className} cursor-pointer`}>
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="Profile" /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </Button>
    );
  }

  return (
    <Avatar className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="Profile" /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
};
