import { BarChart3, ChevronDown, Sparkles, Target, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ClassroomAnalyticsViewModel } from '@/components/features/analytics/useClassroomAnalyticsViewModel';
import type { HardSkillAssessmentWithStudent } from '@/types/hard-skills';
import type { FiveDScores } from '@/types/models';
import {
  MainAnalytics5dNarrativeBlock,
  StudentList5dNarrativeBlock,
} from '@/components/analytics/Analytics5dNarrativeBlocks';
import { HardSkillsAssessmentTable } from '@/components/features/analytics/HardSkillsAssessmentTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DEFAULT_SCORE } from '@/config/constants';

type AnalyticsMainChartsSectionProps = Pick<
  ClassroomAnalyticsViewModel,
  | 'classroomId'
  | 'isRTL'
  | 'analyticsLanguage'
  | 'data'
  | 'allStudents'
  | 'assignments'
  | 'selectedModule'
  | 'selectedAssignment'
  | 'selectedStudent'
  | 'classAverage'
  | 'classAverageQed'
  | 'effectiveAssignmentIds'
  | 'moduleScopeIds'
  | 'exportFilterSummary'
  | 'main5dNarrativeId'
  | 'main5dNarrativeEvidence'
  | 'studentList5dEvidenceById'
  | 'studentsForCollapsible'
  | 'craForModuleWithAllAssignments'
  | 'showTopCra'
  | 'showAllStudentsCraList'
  | 'chartSubtext'
  | 'student5dNarrativeOpen'
  | 'toggleStudent5dNarrative'
>;

export const AnalyticsMainChartsSection = ({
  classroomId,
  isRTL,
  analyticsLanguage,
  data,
  allStudents,
  assignments,
  selectedModule,
  selectedAssignment,
  selectedStudent,
  classAverage,
  classAverageQed,
  effectiveAssignmentIds,
  moduleScopeIds,
  exportFilterSummary,
  main5dNarrativeId,
  main5dNarrativeEvidence,
  studentList5dEvidenceById,
  studentsForCollapsible,
  craForModuleWithAllAssignments,
  showTopCra,
  showAllStudentsCraList,
  chartSubtext,
  student5dNarrativeOpen,
  toggleStudent5dNarrative,
}: AnalyticsMainChartsSectionProps) => {
  const { t } = useTranslation();

  return (
    <div className="lg:col-span-2 space-y-8">
      {classAverage && effectiveAssignmentIds.length > 0 && (
        <Card
          className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <CardHeader className="border-b border-border pb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle
                  className={`text-xl font-bold text-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  {selectedStudent === 'all'
                    ? t('analytics.classAverage')
                    : allStudents.find((s) => s.id === selectedStudent)?.name}
                </CardTitle>
                <CardDescription className={`mt-1 ms-11 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {chartSubtext}
                </CardDescription>
              </div>
              {selectedStudent === 'all' && (
                <Badge
                  variant="secondary"
                  className="rounded-full px-4 py-1 bg-primary/10 text-primary"
                >
                  {t('classroomAnalytics.classOverview')}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {classAverage ? (
              <MainAnalytics5dNarrativeBlock
                classroomId={classroomId}
                classAverage={classAverage}
                classAverageQed={classAverageQed}
                filterSummary={exportFilterSummary}
                language={analyticsLanguage}
                selectedStudent={selectedStudent}
                studentName={allStudents.find((s) => s.id === selectedStudent)?.name}
                isRTL={isRTL}
                enabled
                narrativeId={main5dNarrativeId}
                evidenceText={main5dNarrativeEvidence.evidenceText}
                evidenceSourceCount={main5dNarrativeEvidence.sourceCount}
              />
            ) : null}
          </CardContent>
        </Card>
      )}

      {showTopCra && (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
          <HardSkillsAssessmentTable
            studentId={selectedStudent === 'all' ? undefined : selectedStudent}
            assignmentId={craForModuleWithAllAssignments ? 'all' : selectedAssignment}
            classroomId={classroomId}
            classroomAssignmentIdFilter={craForModuleWithAllAssignments ? moduleScopeIds : null}
            title={t('cra.title')}
            description={
              selectedStudent !== 'all'
                ? t('classroomAnalytics.hardSkillsFor', {
                    student: allStudents.find((s) => s.id === selectedStudent)?.name,
                  })
                : t('classroomAnalytics.hardSkillsAssignmentFor', {
                    assignment: assignments.find((a) => a.id === selectedAssignment)?.title,
                  })
            }
          />
        </div>
      )}

      {selectedStudent === 'all' && selectedAssignment === 'all' && (
        <Card
          className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <CardHeader className="border-b border-border pb-6">
            <CardTitle
              className={`text-xl font-bold text-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
            >
              <div className="p-2 bg-primary/10 rounded-xl">
                <Users className="h-5 w-5 text-primary" />
              </div>
              {t('classroomAnalytics.studentPerformanceOverview')}
            </CardTitle>
            <CardDescription className={`ms-11 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('classroomAnalytics.detailedBreakdown')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {studentsForCollapsible.filter((s) => s.latestScores).length === 0 ? (
              <div
                className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border"
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                <p className={`text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('classroomAnalytics.noStudentDataInScope')}
                </p>
              </div>
            ) : (
              studentsForCollapsible
                .filter((s) => s.latestScores)
                .map((student) => (
                  <Collapsible
                    key={student.id}
                    open={student5dNarrativeOpen.has(student.id)}
                    onOpenChange={(open) => toggleStudent5dNarrative(student.id, open)}
                    className="border border-border rounded-lg overflow-hidden bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-5 h-auto hover:bg-transparent"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {student.fullName.charAt(0)}
                          </div>
                          <span
                            className={`font-semibold text-foreground text-base ${isRTL ? 'text-right' : 'text-left'}`}
                          >
                            {student.fullName}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="rounded-full bg-card">
                            {student.feedbackCount} {t('classroomAnalytics.submissions')}
                          </Badge>
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-5 pb-5 space-y-6 bg-card/50 border-t border-border">
                      <div className="pt-4">
                        <h4
                          className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
                        >
                          <Sparkles className="h-3 w-3" />
                          {t('classroomAnalytics.average5DProfile')}
                        </h4>
                        <StudentList5dNarrativeBlock
                          classroomId={classroomId}
                          studentId={student.id}
                          studentName={student.fullName}
                          scores={
                            (student.latestScores ?? {
                              vision: DEFAULT_SCORE,
                              values: DEFAULT_SCORE,
                              thinking: DEFAULT_SCORE,
                              connection: DEFAULT_SCORE,
                              action: DEFAULT_SCORE,
                            }) as FiveDScores
                          }
                          qedMeasures={student.latestQedMeasures ?? null}
                          filterSummary={exportFilterSummary}
                          language={analyticsLanguage}
                          isOpen={student5dNarrativeOpen.has(student.id)}
                          isRTL={isRTL}
                          enabled
                          evidenceText={studentList5dEvidenceById.get(student.id)?.evidenceText}
                          evidenceSourceCount={
                            studentList5dEvidenceById.get(student.id)?.sourceCount
                          }
                        />
                      </div>
                      <div className="border-t border-border pt-6">
                        <HardSkillsAssessmentTable
                          studentId={student.id}
                          assignmentId="all"
                          classroomId={classroomId}
                          classroomAssignmentIdFilter={
                            selectedModule === 'all' ? null : moduleScopeIds
                          }
                          initialData={student.hardSkills as HardSkillAssessmentWithStudent[]}
                          title={t('cra.title')}
                          description={t('classroomAnalytics.allHardSkills')}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))
            )}
          </CardContent>
        </Card>
      )}

      {showAllStudentsCraList && (
        <Card
          className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <CardHeader className="border-b border-border pb-6">
            <CardTitle
              className={`text-xl font-bold text-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
            >
              <div className="p-2 bg-primary/10 rounded-xl">
                <Target className="h-5 w-5 text-primary" />
              </div>
              {t('cra.title')}
            </CardTitle>
            <CardDescription className={`ms-11 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('classroomAnalytics.hardSkillsAllStudents', {
                assignment: assignments.find((a) => a.id === selectedAssignment)?.title,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {allStudents.map((student) => (
              <Collapsible
                key={student.id}
                className="border border-border rounded-lg overflow-hidden bg-muted/20"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-5 h-auto hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {student.name.charAt(0)}
                      </div>
                      <span
                        className={`font-semibold text-foreground text-base ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        {student.name}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-5 pb-5 bg-card/50 border-t border-border pt-4">
                  <HardSkillsAssessmentTable
                    studentId={student.id}
                    assignmentId={selectedAssignment}
                    classroomId={classroomId}
                    initialData={
                      (data?.rawHardSkills?.filter(
                        (h) => h.student_id === student.id && h.assignment_id === selectedAssignment
                      ) ?? []) as HardSkillAssessmentWithStudent[]
                    }
                    title=""
                    description=""
                  />
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
