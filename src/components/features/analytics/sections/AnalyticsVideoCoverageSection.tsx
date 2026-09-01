import { useTranslation } from 'react-i18next';
import type { ClassroomAnalyticsViewModel } from '@/components/features/analytics/useClassroomAnalyticsViewModel';
import type { Analytics5dNarrativeRow } from '@/lib/analytics5dEvidence';
import { AnalyticsCompare5dCard } from '@/components/analytics/AnalyticsCompare5dCard';
import { VideoEngagementPanel } from '@/components/features/analytics/VideoEngagementPanel';

type AnalyticsVideoCoverageSectionProps = Pick<
  ClassroomAnalyticsViewModel,
  | 'classroomId'
  | 'isRTL'
  | 'data'
  | 'allStudents'
  | 'coveredStudents'
  | 'studentCount'
  | 'modules'
  | 'assignments'
  | 'showUnplaced'
  | 'structKey'
  | 'analyticsLanguage'
  | 'sectionTitleResolver'
>;

export const AnalyticsVideoCoverageSection = ({
  classroomId,
  isRTL,
  data,
  allStudents,
  coveredStudents,
  studentCount,
  modules,
  assignments,
  showUnplaced,
  structKey,
  analyticsLanguage,
  sectionTitleResolver,
}: AnalyticsVideoCoverageSectionProps) => {
  const { t } = useTranslation();

  return (
    <>
      <VideoEngagementPanel classroomId={classroomId} students={allStudents} isRTL={isRTL} />

      <div
        className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-foreground"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <p className={isRTL ? 'text-right' : 'text-left'}>
          {t('analytics.coverageInScope', { covered: coveredStudents, enrolled: studentCount })}
        </p>
      </div>

      {data ? (
        <AnalyticsCompare5dCard
          classroomId={classroomId}
          modules={modules}
          assignments={assignments}
          students={data.students.map((s) => ({
            id: s.id,
            fullName: s.fullName,
            snapshots: s.snapshots,
            narrativeRows: (s as { narrativeRows?: Analytics5dNarrativeRow[] }).narrativeRows,
          }))}
          showUnplaced={showUnplaced}
          structKey={structKey}
          analyticsLanguage={analyticsLanguage}
          isRTL={isRTL}
          rawSubmissions={data.rawSubmissions}
          rawSnapshots={data.rawSnapshots}
          sectionTitleResolver={sectionTitleResolver}
        />
      ) : null}
    </>
  );
};
