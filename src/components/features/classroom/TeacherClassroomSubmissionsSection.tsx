import { useTranslation } from 'react-i18next';
import { SubmissionsTab } from '@/components/SubmissionsTab';

export type TeacherClassroomSubmissionsSectionProps = {
  classroomId: string;
  isRTL: boolean;
  initialAssignmentFilterId?: string;
};

export function TeacherClassroomSubmissionsSection({
  classroomId,
  isRTL,
  initialAssignmentFilterId,
}: TeacherClassroomSubmissionsSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2
          className={`text-2xl md:text-3xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
        >
          {t('classroomDetail.submissions.title')}
        </h2>
        <p className={`text-muted-foreground mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('classroomDetail.submissions.subtitle')}
        </p>
      </div>
      <SubmissionsTab
        classroomId={classroomId}
        initialAssignmentFilterId={initialAssignmentFilterId}
      />
    </div>
  );
}
