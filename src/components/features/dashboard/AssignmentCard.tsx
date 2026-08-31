import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SecureAvatarImage } from '@/components/ui/SecureAvatarImage';
import { TEACHER_AVATARS_BUCKET } from '@/utils/storageUrls';

interface AssignmentCardProps {
  assignment: {
    id: string;
    title: string;
    due_at: string;
    classrooms: {
      name: string;
      teacher_profiles?: {
        full_name: string;
        avatar_url?: string;
      } | null;
    };
  };
  onClick: () => void;
}

/**
 * Assignment card component for student dashboard
 * Displays assignment with teacher information
 */
export const AssignmentCard = ({ assignment, onClick }: AssignmentCardProps) => {
  const { t } = useTranslation();

  const getTeacherInitials = () => {
    if (!assignment.classrooms.teacher_profiles?.full_name) return 'T';
    return assignment.classrooms.teacher_profiles.full_name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <Card
      className="hover:shadow-lg transition-shadow cursor-pointer bg-card border-border"
      onClick={onClick}
    >
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-base mb-1 text-foreground">{assignment.title}</CardTitle>
        <CardDescription className="text-sm mb-2 text-muted-foreground">
          {assignment.classrooms.name} • {t('common.due')}:{' '}
          {new Date(assignment.due_at).toLocaleDateString()}
        </CardDescription>
        <div className="flex items-center gap-2 mt-2">
          <Avatar className="h-6 w-6">
            {assignment.classrooms.teacher_profiles?.avatar_url && (
              <SecureAvatarImage
                src={assignment.classrooms.teacher_profiles.avatar_url}
                bucket={TEACHER_AVATARS_BUCKET}
                alt={assignment.classrooms.teacher_profiles.full_name || t('common.teacher')}
              />
            )}
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {getTeacherInitials()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">
            {assignment.classrooms.teacher_profiles?.full_name || t('common.teacher')}
          </span>
        </div>
      </CardHeader>
    </Card>
  );
};
