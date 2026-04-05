import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FiveDChart } from './FiveDChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HardSkillsAssessmentTable } from './HardSkillsAssessmentTable';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChevronDown, Users, BookOpen, FileText, CheckCircle2, BarChart3, Filter, Sparkles, Trophy, Target } from 'lucide-react';
import { useClassroomAnalytics } from '@/hooks/queries';
import { NuanceInsightsTable } from '@/components/features/analytics/NuanceInsightsTable';
import { AnalyticsFilterControls } from '@/components/features/analytics/AnalyticsFilterControls';
import { RegenerateScoresButton } from '@/components/RegenerateScoresButton';

interface ClassroomAnalyticsProps {
  classroomId: string;
  onRegenerateComplete?: () => void;
}

export function ClassroomAnalytics({ classroomId, onRegenerateComplete }: ClassroomAnalyticsProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  
  const [selectedAssignment, setSelectedAssignment] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<string>('all');

  const { data, isLoading: loading } = useClassroomAnalytics(classroomId);

  const students = data?.students || [];
  const allStudents = data?.allStudents || [];
  const assignments = data?.assignments || [];
  const studentCount = data?.studentCount || 0;
  const assignmentCount = data?.assignmentCount || 0;

  // Calculate class average or individual student scores based on filter
  const classAverage = useMemo(() => {
    if (!data) return null;

    let targetStudents = data.students;

    // Filter by student first
    if (selectedStudent !== 'all') {
      const student = data.students.find((s) => s.id === selectedStudent);
      if (!student) return null;
      targetStudents = [student];
    }

    // Now calculate average based on selected assignment
    if (selectedAssignment === 'all') {
      // If student was selected, we already have their overall average in student.latestScores
      if (selectedStudent !== 'all') {
        return targetStudents[0].latestScores;
      }
      
      // Class average across all students and all assignments
      const validScores = data.students.filter((s) => s.latestScores);
      if (validScores.length === 0) return null;

      const totals = { vision: 0, values: 0, thinking: 0, connection: 0, action: 0 };
      validScores.forEach((s) => {
        if (s.latestScores) {
          Object.keys(totals).forEach((key) => {
            totals[key as keyof typeof totals] += s.latestScores![key as keyof typeof totals];
          });
        }
      });
      
      return Object.keys(totals).reduce(
        (acc, key) => ({
          ...acc,
          [key]: totals[key as keyof typeof totals] / validScores.length,
        }),
        {} as any
      );
    } else {
      // Filter average for specific assignment
      const snapshotsForAssignment = data.rawSnapshots.filter(s => 
        s.assignment_id === selectedAssignment || 
        (data.rawSubmissions.find(sub => sub.id === s.submission_id)?.assignment_id === selectedAssignment)
      );

      // If we also filtered by student
      const finalSnapshots = selectedStudent === 'all' 
        ? snapshotsForAssignment 
        : snapshotsForAssignment.filter(s => s.user_id === selectedStudent);

      if (finalSnapshots.length === 0) return null;

      const totals = { vision: 0, values: 0, thinking: 0, connection: 0, action: 0 };
      finalSnapshots.forEach(s => {
        const scores = s.scores as any;
        Object.keys(totals).forEach(k => {
          totals[k as keyof typeof totals] += scores[k] || 0;
        });
      });

      return Object.keys(totals).reduce((acc, k) => ({
        ...acc,
        [k]: totals[k as keyof typeof totals] / finalSnapshots.length
      }), {} as any);
    }
  }, [data, selectedAssignment, selectedStudent]);

  if (loading && !data) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <NuanceInsightsTable
        classroomId={classroomId}
        students={allStudents}
        assignments={assignments}
        selectedStudent={selectedStudent}
        selectedAssignment={selectedAssignment}
        onStudentChange={setSelectedStudent}
        onAssignmentChange={setSelectedAssignment}
      />

      <Card className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
        <CardHeader className="pb-2 space-y-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className={`flex items-center gap-3 text-xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                <div className="p-2.5 bg-primary/10 rounded-lg shrink-0">
                  <Filter className="h-6 w-6 text-primary" />
                </div>
                {t('analytics.filtersTitle')}
              </CardTitle>
              <CardDescription className={`ms-12 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('analytics.filtersDescription')}
              </CardDescription>
            </div>
            {onRegenerateComplete ? (
              <RegenerateScoresButton
                classroomId={classroomId}
                onComplete={onRegenerateComplete}
                compact
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <AnalyticsFilterControls
            allStudents={allStudents}
            assignments={assignments}
            selectedStudent={selectedStudent}
            selectedAssignment={selectedAssignment}
            onStudentChange={setSelectedStudent}
            onAssignmentChange={setSelectedAssignment}
          />
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[28px] border-none shadow-md bg-card/80 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium text-muted-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="p-1.5 bg-primary/10 rounded-md">
                <Users className="h-3.5 w-3.5 text-primary" />
              </div>
              {t('analytics.totalStudents')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">{studentCount}</div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-none shadow-md bg-card/80 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium text-muted-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="p-1.5 bg-primary/10 rounded-md">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
              </div>
              {t('analytics.assignments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">{assignmentCount}</div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-none shadow-md bg-card/80 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium text-muted-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="p-1.5 bg-primary/10 rounded-md">
                <FileText className="h-3.5 w-3.5 text-primary" />
              </div>
              {t('analytics.totalSubmissions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">
              {students.reduce((s, st) => s + st.feedbackCount, 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-none shadow-md bg-card/80 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium text-muted-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="p-1.5 bg-primary/10 rounded-md">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              </div>
              {t('analytics.completionRate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">
              {studentCount > 0
                ? Math.round(
                  (students.filter((s) => s.feedbackCount > 0).length / studentCount) * 100
                )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Charts */}
        <div className="lg:col-span-2 space-y-8">
          {classAverage && (
            <Card className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
              <CardHeader className="border-b border-border pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className={`text-xl font-bold text-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <div className="p-2 bg-primary/10 rounded-xl">
                        <BarChart3 className="h-5 w-5 text-primary" />
                      </div>
                      {selectedStudent === 'all' ? t('analytics.classAverage') : allStudents.find((s) => s.id === selectedStudent)?.name}
                    </CardTitle>
                    <CardDescription className={`mt-1 ms-11 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {selectedAssignment === 'all'
                        ? t('classroomAnalytics.averageScoresAcross')
                        : t('classroomAnalytics.scoresFor', { assignment: assignments.find((a) => a.id === selectedAssignment)?.title })}
                    </CardDescription>
                  </div>
                  {selectedStudent === 'all' && (
                    <Badge variant="secondary" className="rounded-full px-4 py-1 bg-primary/10 text-primary">
                      {t('classroomAnalytics.classOverview')}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <FiveDChart scores={classAverage} explanations={null} />
              </CardContent>
            </Card>
          )}

          {/* CRA Section */}
          {(selectedStudent !== 'all' || selectedAssignment !== 'all') && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
              <HardSkillsAssessmentTable
                studentId={selectedStudent === 'all' ? undefined : selectedStudent}
                assignmentId={selectedAssignment}
                classroomId={classroomId}
                title={t('cra.title')}
                description={
                  selectedStudent !== 'all'
                    ? t('classroomAnalytics.hardSkillsFor', { student: allStudents.find((s) => s.id === selectedStudent)?.name })
                    : t('classroomAnalytics.hardSkillsAssignmentFor', { assignment: assignments.find((a) => a.id === selectedAssignment)?.title })
                }
              />
            </div>
          )}

          {/* All Students List (Collapsible) */}
          {selectedStudent === 'all' && selectedAssignment === 'all' && (
            <Card className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
              <CardHeader className="border-b border-border pb-6">
                <CardTitle className={`text-xl font-bold text-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
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
                {students.filter((s) => s.latestScores).length === 0 ? (
                  <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border" dir={isRTL ? 'rtl' : 'ltr'}>
                    <p className={`text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{t('classroomAnalytics.noStudentData')}</p>
                  </div>
                ) : (
                  students
                    .filter((s) => s.latestScores)
                    .map((student) => (
                      <Collapsible key={student.id} className="border border-border rounded-lg overflow-hidden bg-muted/20 hover:bg-muted/40 transition-colors">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-5 h-auto hover:bg-transparent"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                {student.fullName.charAt(0)}
                              </div>
                              <span className={`font-semibold text-foreground text-base ${isRTL ? 'text-right' : 'text-left'}`}>
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
                          {/* Student's Average 5D Chart */}
                          <div className="pt-4">
                            <h4 className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                              <Sparkles className="h-3 w-3" />
                              {t('classroomAnalytics.average5DProfile')}
                            </h4>
                            <FiveDChart scores={student.latestScores!} explanations={null} />
                          </div>

                          {/* Student's CRA Table */}
                          <div className="border-t border-border pt-6">
                            <HardSkillsAssessmentTable
                              studentId={student.id}
                              assignmentId="all"
                              classroomId={classroomId}
                              initialData={student.hardSkills as any}
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

          {/* Case 4: All Students + Specific Assignment - List of students with CRA */}
          {selectedStudent === 'all' && selectedAssignment !== 'all' && (
            <Card className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
              <CardHeader className="border-b border-border pb-6">
                <CardTitle className={`text-xl font-bold text-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  {t('cra.title')}
                </CardTitle>
                <CardDescription className={`ms-11 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('classroomAnalytics.hardSkillsAllStudents', { assignment: assignments.find((a) => a.id === selectedAssignment)?.title })}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {allStudents.map((student) => (
                  <Collapsible key={student.id} className="border border-border rounded-lg overflow-hidden bg-muted/20">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-5 h-auto hover:bg-muted/40">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {student.name.charAt(0)}
                          </div>
                          <span className={`font-semibold text-foreground text-base ${isRTL ? 'text-right' : 'text-left'}`}>
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
                        initialData={(data?.rawHardSkills?.filter(h => h.student_id === student.id && h.assignment_id === selectedAssignment) || []) as any}
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

        {/* Right Column: Summary Stats */}
        <div className="space-y-6">
          <Card className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden sticky top-6" dir={isRTL ? 'rtl' : 'ltr'}>
            <CardHeader className="bg-transparent border-b border-border pb-6">
              <CardTitle className={`text-lg font-bold text-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                {t('analytics.performanceSummary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                  <div>
                    <p className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('analytics.activeStudents')}
                    </p>
                    <p className={`text-2xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                      {students.filter((s) => s.feedbackCount > 0).length} <span className="text-sm text-muted-foreground font-normal">/ {studentCount}</span>
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                  <div>
                    <p className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('analytics.avgSubmissions')}
                    </p>
                    <p className={`text-2xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                      {studentCount > 0
                        ? (
                          students.reduce((sum, s) => sum + s.feedbackCount, 0) / studentCount
                        ).toFixed(1)
                        : 0}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                  <div>
                    <p className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('analytics.engagementRate')}
                    </p>
                    <p className={`text-2xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                      {studentCount > 0
                        ? Math.round(
                          (students.filter((s) => s.feedbackCount > 0).length / studentCount) * 100
                        )
                        : 0}
                      %
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
              </div>

              {students.filter((s) => s.latestScores).length > 0 && (
                <div className="pt-6 border-t border-border">
                  <h4 className={`text-sm font-bold text-foreground mb-4 flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <Sparkles className="h-4 w-4 text-primary" />
                    {t('analytics.average5D')}
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(classAverage || {}).map(([dimension, score]) => (
                      <div key={dimension} className="flex items-center justify-between">
                        <span className={`text-sm font-medium text-muted-foreground capitalize ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t(`submissionDetail.dimensions.${dimension}`)}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${(score / 10) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-foreground w-8 text-right">
                            {score.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
