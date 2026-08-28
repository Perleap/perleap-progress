import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { ClassroomAnalytics } from '@/components/ClassroomAnalytics';
import { analyticsKeys, pilotReportKeys, useClassroom } from '@/hooks/queries';
import { invalidatePilotReportSnapshots } from '@/services/pilotReportCacheService';

export type TeacherClassroomAnalyticsSectionProps = {
  classroomId: string;
  classroomName: string;
  isRTL: boolean;
};

export function TeacherClassroomAnalyticsSection({
  classroomId,
  classroomName,
  isRTL,
}: TeacherClassroomAnalyticsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { refetch: refetchClassroom } = useClassroom(classroomId);

  const handleRegenerateComplete = useCallback(async () => {
    await invalidatePilotReportSnapshots(classroomId);
    await queryClient.invalidateQueries({
      queryKey: [...pilotReportKeys.all, 'snapshot', classroomId],
    });
    await queryClient.invalidateQueries({
      queryKey: analyticsKeys.classroom(classroomId),
    });
    await queryClient.invalidateQueries({
      queryKey: ['evaluation-refresh-batch', classroomId],
    });
    await refetchClassroom();
  }, [classroomId, refetchClassroom, queryClient]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-muted/50 rounded-xl">
          <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
        </div>
        <h2
          className={`text-2xl md:text-3xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
        >
          {t('classroomDetail.analytics')}
        </h2>
      </div>
      <ClassroomAnalytics
        classroomId={classroomId}
        classroomName={classroomName}
        onRegenerateComplete={handleRegenerateComplete}
      />
    </div>
  );
}
