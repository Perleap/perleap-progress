import { Download, Filter, Info, Presentation, ClipboardCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ClassroomAnalyticsViewModel } from '@/components/features/analytics/useClassroomAnalyticsViewModel';
import { AnalyticsFilterControls } from '@/components/features/analytics/AnalyticsFilterControls';
import { RegenerateScoresButton } from '@/components/features/analytics/RegenerateScoresButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type AnalyticsFiltersActionsSectionProps = Pick<
  ClassroomAnalyticsViewModel,
  | 'isRTL'
  | 'data'
  | 'studentCount'
  | 'allStudents'
  | 'visibleAssignments'
  | 'modules'
  | 'showUnplaced'
  | 'selectedModule'
  | 'selectedAssignment'
  | 'selectedStudent'
  | 'moduleFilterLabel'
  | 'allModulesLabel'
  | 'allAssignmentsInScopeLabel'
  | 'showRegenerateNote'
  | 'showEmptyModuleScope'
  | 'onModuleChange'
  | 'onAssignmentChange'
  | 'onStudentChange'
  | 'handleExportCsv'
  | 'handleExportLessonBriefPdf'
  | 'handleOpenPilotReport'
> & {
  classroomId: string;
  onRegenerateComplete?: () => void;
};

export const AnalyticsFiltersActionsSection = ({
  classroomId,
  isRTL,
  data,
  studentCount,
  allStudents,
  visibleAssignments,
  modules,
  showUnplaced,
  selectedModule,
  selectedAssignment,
  selectedStudent,
  moduleFilterLabel,
  allModulesLabel,
  allAssignmentsInScopeLabel,
  showRegenerateNote,
  showEmptyModuleScope,
  onModuleChange,
  onAssignmentChange,
  onStudentChange,
  handleExportCsv,
  handleExportLessonBriefPdf,
  handleOpenPilotReport,
  onRegenerateComplete,
}: AnalyticsFiltersActionsSectionProps) => {
  const { t } = useTranslation();

  return (
    <>
      <Card
        className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <CardHeader className="pb-2 space-y-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle
                className={`flex items-center gap-3 text-xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
              >
                <div className="p-2.5 bg-primary/10 rounded-lg shrink-0">
                  <Filter className="h-6 w-6 text-primary" />
                </div>
                {t('analytics.filtersTitle')}
              </CardTitle>
              <CardDescription className={`ms-12 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('analytics.filtersDescription')}
              </CardDescription>
            </div>
            <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0 w-full sm:w-auto">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={handleExportCsv}
                  disabled={!data}
                >
                  <Download className="h-4 w-4 me-1.5" aria-hidden />
                  {t('analytics.exportCsv')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={handleExportLessonBriefPdf}
                  disabled={!data || studentCount === 0}
                >
                  <Presentation className="h-4 w-4 me-1.5" aria-hidden />
                  {t('analytics.lessonBrief.exportPdf')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={handleOpenPilotReport}
                  disabled={!data || studentCount === 0}
                >
                  <ClipboardCheck className="h-4 w-4 me-1.5" aria-hidden />
                  {t('pilotReport.openButton')}
                </Button>
                {onRegenerateComplete ? (
                  <RegenerateScoresButton
                    classroomId={classroomId}
                    onComplete={onRegenerateComplete}
                    compact
                  />
                ) : null}
              </div>
              {onRegenerateComplete && showRegenerateNote ? (
                <p className="flex items-start gap-1.5 max-w-[min(100%,18rem)] text-xs text-muted-foreground text-end self-end">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                  {t('analytics.regenerateClassWideNote')}
                </p>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <AnalyticsFilterControls
            allStudents={allStudents}
            assignments={visibleAssignments}
            modules={modules}
            showUnplacedOption={showUnplaced}
            selectedModule={selectedModule}
            onModuleChange={onModuleChange}
            moduleFilterLabel={moduleFilterLabel}
            allModulesLabel={allModulesLabel}
            selectedStudent={selectedStudent}
            selectedAssignment={selectedAssignment}
            onStudentChange={onStudentChange}
            onAssignmentChange={onAssignmentChange}
            allAssignmentsInScopeLabel={allAssignmentsInScopeLabel}
          />
        </CardContent>
      </Card>

      {showEmptyModuleScope ? (
        <div
          className="text-center text-muted-foreground text-sm border border-dashed border-border rounded-xl py-8 px-4"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {t('analytics.emptyModuleOrScope')}
        </div>
      ) : null}
    </>
  );
};
