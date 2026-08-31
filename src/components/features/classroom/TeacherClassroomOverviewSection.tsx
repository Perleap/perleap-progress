import { useTranslation } from 'react-i18next';
import { CoursePackageCard } from '@/components/features/syllabus';
import type { Classroom } from '@/types/models';
import {
  ClassroomActionBar,
  CourseInfoCards,
  CourseMaterialsGrid,
  DomainsAccordion,
  InviteCodeCard,
  LearningOutcomesChallengesCard,
} from './overview';

export type TeacherClassroomOverviewSectionProps = {
  classroomId: string;
  classroom: Classroom;
  isRTL: boolean;
  onEdit: () => void;
  onRequestReset: () => void;
  onRequestDelete: () => void;
  resetButtonDisabled: boolean;
};

export const TeacherClassroomOverviewSection = ({
  classroomId,
  classroom,
  isRTL,
  onEdit,
  onRequestReset,
  onRequestDelete,
  resetButtonDisabled,
}: TeacherClassroomOverviewSectionProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h2
        className={`text-2xl md:text-3xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
      >
        {t('classroomDetail.overview.title')}
      </h2>

      <div className="flex flex-col gap-6">
        <InviteCodeCard classroom={classroom} isRTL={isRTL} t={t} />

        <CoursePackageCard classroomId={classroomId} classroomName={classroom.name} isRTL={isRTL} />

        <CourseInfoCards classroom={classroom} isRTL={isRTL} t={t} />

        <LearningOutcomesChallengesCard classroom={classroom} isRTL={isRTL} t={t} />
      </div>

      <DomainsAccordion classroom={classroom} isRTL={isRTL} t={t} />

      <CourseMaterialsGrid classroom={classroom} isRTL={isRTL} t={t} />

      <ClassroomActionBar
        isRTL={isRTL}
        resetButtonDisabled={resetButtonDisabled}
        onEdit={onEdit}
        onRequestReset={onRequestReset}
        onRequestDelete={onRequestDelete}
        t={t}
      />
    </div>
  );
};
