import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EmptyClassroomsProps {
  userType: 'teacher' | 'student';
  onAction: () => void;
}

/**
 * Empty state component for when user has no classrooms
 * Shows different messages for teachers and students
 */
export const EmptyClassrooms = ({ userType, onAction }: EmptyClassroomsProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {userType === 'teacher'
            ? t('teacherDashboard.empty.title')
            : t('studentDashboard.empty.noClasses')}
        </h3>
        <p className="text-muted-foreground mb-4 text-center">
          {userType === 'teacher'
            ? t('teacherDashboard.empty.description')
            : t('studentDashboard.empty.noClassesDescription')}
        </p>
        <Button onClick={onAction}>
          <Plus className="me-2 h-4 w-4" />
          {userType === 'teacher'
            ? t('teacherDashboard.createClassroom')
            : t('studentDashboard.joinClass')}
        </Button>
      </CardContent>
    </Card>
  );
};
