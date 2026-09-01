import { NuanceInsightsTable } from '@/components/features/analytics/NuanceInsightsTable';
import {
  AnalyticsFiltersActionsSection,
  AnalyticsKpiMetricsSection,
  AnalyticsMainChartsSection,
  AnalyticsPerformanceSummarySection,
  AnalyticsVideoCoverageSection,
} from '@/components/features/analytics/sections';
import { useClassroomAnalyticsViewModel } from '@/components/features/analytics/useClassroomAnalyticsViewModel';

interface ClassroomAnalyticsProps {
  classroomId: string;
  classroomName?: string | null;
  onRegenerateComplete?: () => void;
}

export const ClassroomAnalytics = ({
  classroomId,
  classroomName: _classroomName,
  onRegenerateComplete,
}: ClassroomAnalyticsProps) => {
  const vm = useClassroomAnalyticsViewModel({ classroomId });

  if (vm.loading && !vm.data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <NuanceInsightsTable
        classroomId={classroomId}
        students={vm.allStudents}
        assignments={vm.assignments}
        modules={vm.modules}
        showUnplacedOption={vm.showUnplaced}
        selectedModule={vm.selectedModule}
        onModuleChange={vm.onModuleChange}
        moduleFilterLabel={vm.moduleFilterLabel}
        allModulesLabel={vm.allModulesLabel}
        allAssignmentsInScopeLabel={vm.allAssignmentsInScopeLabel}
        visibleAssignments={vm.visibleAssignments}
        filterAssignmentIds={vm.effectiveAssignmentIds}
        selectedStudent={vm.selectedStudent}
        selectedAssignment={vm.selectedAssignment}
        onStudentChange={vm.onStudentChange}
        onAssignmentChange={vm.onAssignmentChange}
      />

      <AnalyticsFiltersActionsSection
        {...vm}
        onRegenerateComplete={onRegenerateComplete}
        classroomId={classroomId}
      />

      <AnalyticsKpiMetricsSection {...vm} />

      <AnalyticsVideoCoverageSection {...vm} />

      <div className="grid lg:grid-cols-3 gap-8">
        <AnalyticsMainChartsSection {...vm} />
        <AnalyticsPerformanceSummarySection {...vm} />
      </div>
    </div>
  );
};
