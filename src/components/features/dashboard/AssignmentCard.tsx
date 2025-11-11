import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTranslation } from 'react-i18next';

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
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onClick}>
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-base mb-1">{assignment.title}</CardTitle>
        <CardDescription className="text-sm mb-2">
          {assignment.classrooms.name} • {t('common.due')}:{' '}
          {new Date(assignment.due_at).toLocaleDateString()}
        </CardDescription>
        <div className="flex items-center gap-2 mt-2">
          <Avatar className="h-6 w-6">
            {assignment.classrooms.teacher_profiles?.avatar_url && (
              <AvatarImage
                src={assignment.classrooms.teacher_profiles.avatar_url}
                alt={assignment.classrooms.teacher_profiles.full_name || t('common.teacher')}
              />
            )}
            <AvatarFallback className="text-xs">{getTeacherInitials()}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">
            {assignment.classrooms.teacher_profiles?.full_name || t('common.teacher')}
          </span>
        </div>
      </CardHeader>
    </Card>
  );
};
