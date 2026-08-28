import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SecureAvatarImage } from '@/components/ui/SecureAvatarImage';
import { TEACHER_AVATARS_BUCKET } from '@/utils/storageUrls';
import type { StudentDashboardAssignment } from '@/types/api.types';
import type { TeacherProfile } from '@/types/models';

function resolveTeacherProfile(
  profile: TeacherProfile | TeacherProfile[] | null | undefined,
): TeacherProfile | null | undefined {
  if (Array.isArray(profile)) return profile[0];
  return profile;
}

export type StudentDashboardAssignmentRowProps = {
  assignment: StudentDashboardAssignment;
  variant: 'active' | 'finished';
  assignmentTypeLabel: string;
  onClick: () => void;
};

export function StudentDashboardAssignmentRow({
  assignment,
  variant,
  assignmentTypeLabel,
  onClick,
}: StudentDashboardAssignmentRowProps) {
  const { t } = useTranslation();
  const teacherProfile = resolveTeacherProfile(assignment.classrooms.teacher_profiles);
  const teacherName = teacherProfile?.full_name || t('common.teacher');
  const teacherInitials =
    teacherName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || 'T';

  const isActive = variant === 'active';

  return (
    <Card
      className={
        isActive
          ? 'group py-0 hover:shadow-md transition-all duration-200 cursor-pointer border-none shadow-sm rounded-xl bg-card overflow-hidden ring-1 ring-border'
          : 'group py-0 hover:shadow-md transition-all duration-200 cursor-pointer border-none shadow-sm rounded-xl bg-muted/20 overflow-hidden opacity-80 hover:opacity-100 ring-1 ring-border'
      }
      onClick={onClick}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <h3
            className={
              isActive
                ? 'text-lg font-bold group-hover:text-primary transition-colors text-foreground mb-2'
                : 'text-lg font-bold text-foreground/80 mb-2'
            }
          >
            {assignment.title}
          </h3>
          <Badge className="rounded-full px-3 py-0.5 mb-2 bg-primary/10 text-primary hover:bg-primary/20 border-none">
            {assignmentTypeLabel}
          </Badge>
          <div className={`flex flex-wrap items-center gap-2${isActive ? ' text-sm' : ''}`}>
            <Badge
              variant={isActive ? 'outline' : 'secondary'}
              className={
                isActive
                  ? 'rounded-full border-primary/20 text-primary bg-transparent font-normal'
                  : 'rounded-full bg-muted text-muted-foreground font-normal'
              }
            >
              {assignment.classrooms.name}
            </Badge>
            {isActive ? (
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {t('common.due')}: {new Date(assignment.due_at ?? '').toLocaleDateString()}
              </span>
            ) : (
              <Badge className="rounded-full bg-success/10 text-success hover:bg-success/20 border-none">
                {t('common.completed')}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:ps-4 sm:border-s border-border shrink-0">
          {isActive && (
            <div className="text-end hidden sm:block">
              <p className="text-xs text-muted-foreground">{t('common.teacher')}</p>
              <p className="text-sm font-medium truncate max-w-[100px] text-foreground">{teacherName}</p>
            </div>
          )}
          <Avatar
            className={
              isActive ? 'h-10 w-10 border-2 border-card shadow-sm' : 'h-8 w-8 grayscale opacity-70'
            }
          >
            {teacherProfile?.avatar_url && (
              <SecureAvatarImage
                src={teacherProfile.avatar_url}
                bucket={TEACHER_AVATARS_BUCKET}
                alt={teacherName}
              />
            )}
            <AvatarFallback className={isActive ? 'bg-primary/10 text-primary' : undefined}>
              {teacherInitials}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </Card>
  );
}
