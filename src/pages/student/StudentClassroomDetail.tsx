import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { StudentClassroomDetailContent } from '@/components/features/classroom';
import { useClassroom } from '@/hooks/queries';
import { normalizeStudentClassroomDetail } from '@/lib/classroomDetail';

const StudentClassroomDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: rawClassroom, isLoading: classroomLoading } = useClassroom(id);
  const classroom = useMemo(
    () =>
      normalizeStudentClassroomDetail(rawClassroom as unknown as Record<string, unknown> | null | undefined),
    [rawClassroom]
  );

  if (classroomLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!classroom || !id) {
    return null;
  }

  return <StudentClassroomDetailContent classroomId={id} classroom={classroom} />;
};

export default StudentClassroomDetail;
