import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SectionSequentialUnlockFlow } from '@/lib/sectionUnlock';
import type { ModuleFlowStep, StudentProgressStatus, SyllabusWithSections } from '@/types/syllabus';
import { GradingBreakdownView } from '@/components/features/syllabus/GradingBreakdownView';
import { SectionContentPage } from '@/components/features/syllabus/SectionContentPage';
import { StudentActivitiesSection } from '@/components/features/syllabus/StudentActivitiesSection';
import { StudentPoliciesView } from '@/components/features/syllabus/StudentPoliciesView';

type ResumeTarget = { kind: 'assignment' | 'resource'; id: string };

export type StudentClassroomCurriculumSectionProps = {
  classroomId: string;
  isRTL: boolean;
  syllabus: SyllabusWithSections;
  openSectionId: string | null;
  moduleFlowBulk: Record<string, ModuleFlowStep[]>;
  linkedAssignmentsMap: Record<
    string,
    Array<{ id: string; title: string; type: string; due_at: string | null }>
  >;
  studentProgressMap: Record<string, StudentProgressStatus>;
  sequentialUnlockFlow: SectionSequentialUnlockFlow | null;
  resumeTarget: ResumeTarget | null;
  resumeSectionId: string | null;
  curriculumOverviewLoading: boolean;
  onBack: () => void;
  onNavigateSection: (sectionId: string) => void;
  onOpenModuleFullPage: (sectionId: string) => void;
};

export const StudentClassroomCurriculumSection = ({
  classroomId,
  isRTL,
  syllabus,
  openSectionId,
  moduleFlowBulk,
  linkedAssignmentsMap,
  studentProgressMap,
  sequentialUnlockFlow,
  resumeTarget,
  resumeSectionId,
  curriculumOverviewLoading,
  onBack,
  onNavigateSection,
  onOpenModuleFullPage,
}: StudentClassroomCurriculumSectionProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {openSectionId ? (
        <SectionContentPage
          sectionId={openSectionId}
          classroomId={classroomId}
          moduleFlowSteps={moduleFlowBulk[openSectionId] ?? []}
          sections={syllabus.sections}
          sectionResources={syllabus.section_resources || {}}
          linkedAssignmentsMap={linkedAssignmentsMap}
          syllabusId={syllabus.id}
          releaseMode={syllabus.release_mode || 'all_at_once'}
          studentProgressMap={studentProgressMap}
          sequentialUnlockFlow={sequentialUnlockFlow}
          isRTL={isRTL}
          onBack={onBack}
          onNavigateSection={onNavigateSection}
        />
      ) : curriculumOverviewLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center py-20">
          <Loader2
            className="h-8 w-8 animate-spin text-muted-foreground"
            aria-label={t('common.loading')}
          />
        </div>
      ) : (
        <>
          <GradingBreakdownView categories={syllabus.grading_categories} isRTL={isRTL} />
          <StudentActivitiesSection
            classroomId={classroomId}
            isRTL={isRTL}
            resumeTarget={resumeTarget}
            resumeSectionId={resumeSectionId}
            onOpenModuleFullPage={onOpenModuleFullPage}
          />
          <StudentPoliciesView policies={syllabus.policies ?? []} isRTL={isRTL} />
        </>
      )}
    </div>
  );
};
