import { Users, Calendar } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EnrolledStudent } from '@/types/models';
import { TeacherStudentDetailDialog } from '@/components/features/classroom/dialogs/TeacherStudentDetailDialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SecureAvatarImage } from '@/components/ui/SecureAvatarImage';
import { useStaggerAnimation } from '@/hooks/useGsapAnimations';
import { STUDENT_AVATARS_BUCKET } from '@/utils/storageUrls';

export type TeacherClassroomStudentsSectionProps = {
  classroomId: string;
  isRTL: boolean;
  students: EnrolledStudent[];
  isLoading?: boolean;
};

export const TeacherClassroomStudentsSection = ({
  classroomId,
  isRTL,
  students,
}: TeacherClassroomStudentsSectionProps) => {
  const { t } = useTranslation();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string | undefined>(undefined);

  const studentsRef = useStaggerAnimation(':scope > div', 0.04, [students.length]);

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2
            className={`text-2xl md:text-3xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {t('classroomDetail.studentsTab.title')}
          </h2>
          <p className={`text-muted-foreground mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('classroomDetail.studentsTab.subtitle')}
          </p>
        </div>

        <Card className="rounded-xl border-none shadow-sm bg-card ring-1 ring-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Users className="h-5 w-5 text-primary" />
              </div>
              {t('common.students')} ({students.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  {t('classroomDetail.studentsTab.noStudents')}
                </p>
              </div>
            ) : (
              <div
                ref={studentsRef}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {students.map((enrollment) => {
                  const fullName = enrollment.student_profiles?.full_name;
                  const hasName = Boolean(fullName);
                  const displayName = fullName
                    ? fullName
                    : t('classroomDetail.studentsTab.studentIncomplete');
                  const initials = fullName
                    ? fullName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                    : 'S';

                  return (
                    <div
                      key={enrollment.id}
                      className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors bg-card/30 cursor-pointer"
                      onClick={() => {
                        setSelectedStudentId(
                          enrollment.student_profiles?.user_id || enrollment.student_id
                        );
                        setSelectedStudentName(enrollment.student_profiles?.full_name ?? undefined);
                      }}
                    >
                      <Avatar className="h-12 w-12 border-2 border-card shadow-sm">
                        {enrollment.student_profiles?.avatar_url && (
                          <SecureAvatarImage
                            src={enrollment.student_profiles.avatar_url}
                            bucket={STUDENT_AVATARS_BUCKET}
                            alt={displayName}
                          />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-bold text-foreground truncate ${!hasName ? 'text-muted-foreground italic' : ''}`}
                        >
                          {displayName}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {t('classroomDetail.studentsTab.joined')}:{' '}
                          {new Date(enrollment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TeacherStudentDetailDialog
        classroomId={classroomId}
        studentId={selectedStudentId}
        studentName={selectedStudentName}
        open={!!selectedStudentId}
        onClose={() => {
          setSelectedStudentId(null);
          setSelectedStudentName(undefined);
        }}
        isRTL={isRTL}
      />
    </>
  );
};
