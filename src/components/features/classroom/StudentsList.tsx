import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EnrolledStudent {
  id: string;
  created_at: string;
  student_id: string;
  student_profiles: {
    full_name: string;
    avatar_url?: string;
    user_id: string;
  } | null;
}

interface StudentsListProps {
  students: EnrolledStudent[];
}

/**
 * Students list component for classroom detail
 * Displays enrolled students with avatars
 */
export const StudentsList = ({ students }: StudentsListProps) => {
  const { t } = useTranslation();

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return names[0][0].toUpperCase();
  };

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <User className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {t('classroomDetail.students.empty.title')}
          </h3>
          <p className="text-muted-foreground text-center">
            {t('classroomDetail.students.empty.description')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {students.map((enrollment) => {
        const student = enrollment.student_profiles;
        if (!student) return null;

        return (
          <Card key={enrollment.id}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  {student.avatar_url && (
                    <AvatarImage src={student.avatar_url} alt={student.full_name} />
                  )}
                  <AvatarFallback>{getInitials(student.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{student.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('classroomDetail.students.joined')}:{' '}
                    {new Date(enrollment.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
