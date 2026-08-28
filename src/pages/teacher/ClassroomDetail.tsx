import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClassroomDetailContent } from '@/components/features/classroom';
import { useClassroom } from '@/hooks/queries';
import { normalizeClassroomDetail } from '@/lib/classroomDetail';

const ClassroomDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: rawClassroom, isLoading: classroomLoading } = useClassroom(id);
  const classroom = useMemo(
    () => normalizeClassroomDetail(rawClassroom as Record<string, unknown> | null | undefined),
    [rawClassroom],
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

  return <ClassroomDetailContent classroomId={id} classroom={classroom} />;
};

export default ClassroomDetail;
