import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { FiveDChart } from './FiveDChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HardSkillsAssessmentTable } from './HardSkillsAssessmentTable';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Users, BookOpen, FileText, CheckCircle2, BarChart3, Filter, Sparkles, Trophy, Target } from 'lucide-react';

interface ClassroomAnalyticsProps {
  classroomId: string;
}

interface StudentData {
  id: string;
  fullName: string;
  latestScores: {
    vision: number;
    values: number;
    thinking: number;
    connection: number;
    action: number;
  } | null;
  feedbackCount: number;
}

interface Assignment {
  id: string;
  title: string;
}

interface AllStudentsInfo {
  id: string;
  name: string;
}

export function ClassroomAnalytics({ classroomId }: ClassroomAnalyticsProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [studentCount, setStudentCount] = useState(0);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [allStudents, setAllStudents] = useState<AllStudentsInfo[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [classAverage, setClassAverage] = useState<{
    vision: number;
    values: number;
    thinking: number;
    connection: number;
    action: number;
  } | null>(null);

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastFiltersRef = useRef({ classroomId, selectedAssignment, selectedStudent });

  useEffect(() => {
    // Check if filters have changed
    const filtersChanged =
      lastFiltersRef.current.classroomId !== classroomId ||
      lastFiltersRef.current.selectedAssignment !== selectedAssignment ||
      lastFiltersRef.current.selectedStudent !== selectedStudent;

    if (filtersChanged) {
      // Reset refs when filters change
      hasFetchedRef.current = false;
      isFetchingRef.current = false;
      lastFiltersRef.current = { classroomId, selectedAssignment, selectedStudent };
    }

    if (!hasFetchedRef.current && !isFetchingRef.current) {
      fetchAnalytics();
    }
  }, [classroomId, selectedAssignment, selectedStudent]);

  const fetchAnalytics = async () => {
    isFetchingRef.current = true;
    try {
      setLoading(true);

      const { data: enrollData, count: enrollCount } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('classroom_id', classroomId);

      setStudentCount(enrollCount || 0);

      const { data: assignData, error: assignError } = await supabase
        .from('assignments')
        .select('id, title')
        .eq('classroom_id', classroomId);

      if (!assignError && assignData) {
        setAssignmentCount(assignData.length);
        setAssignments(assignData);
      }

      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('classroom_id', classroomId);

      const processedStudents: StudentData[] = [];
      const allStudentsData: Array<{ id: string; name: string }> = [];

      for (const enroll of enrollments || []) {
        const { data: profile } = await supabase
          .from('student_profiles')
          .select('full_name')
          .eq('user_id', enroll.student_id)
          .single();

        const fullName = profile?.full_name || 'Unknown';
        allStudentsData.push({ id: enroll.student_id, name: fullName });

        // Get scores based on assignment filter using submission_id link
        let averageScores = null;

        if (selectedAssignment !== 'all') {
          // For specific assignment: get submissions then their snapshots
          const { data: submissions } = await supabase
            .from('submissions')
            .select('id')
            .eq('student_id', enroll.student_id)
            .eq('assignment_id', selectedAssignment);

          if (submissions && submissions.length > 0) {
            const submissionIds = submissions.map((s) => s.id);

            const { data: snapshots } = await supabase
              .from('five_d_snapshots')
              .select('scores')
              .in('submission_id', submissionIds)
              .eq('classroom_id', classroomId)
              .neq('source', 'onboarding');

            if (snapshots && snapshots.length > 0) {
              const totals = { vision: 0, values: 0, thinking: 0, connection: 0, action: 0 };
              snapshots.forEach((snapshot) => {
                const scores = snapshot.scores as any;
                Object.keys(totals).forEach((key) => {
                  totals[key as keyof typeof totals] += scores[key] || 0;
                });
              });
              averageScores = Object.keys(totals).reduce(
                (acc, key) => ({
                  ...acc,
                  [key]: totals[key as keyof typeof totals] / snapshots.length,
                }),
                {} as typeof totals
              );
            }
          }
        } else {
          // For all assignments: get all submissions for this student, then their snapshots
          const { data: allSubmissions } = await supabase
            .from('submissions')
            .select('id')
            .eq('student_id', enroll.student_id)
            .in('assignment_id', assignData?.map((a) => a.id) || []);

          if (allSubmissions && allSubmissions.length > 0) {
            const submissionIds = allSubmissions.map((s) => s.id);

            const { data: allScoresData } = await supabase
              .from('five_d_snapshots')
              .select('scores')
              .eq('user_id', enroll.student_id)
              .in('submission_id', submissionIds);

            if (allScoresData && allScoresData.length > 0) {
              const totals = { vision: 0, values: 0, thinking: 0, connection: 0, action: 0 };
              allScoresData.forEach((snapshot) => {
                const scores = snapshot.scores as any;
                Object.keys(totals).forEach((key) => {
                  totals[key as keyof typeof totals] += scores[key] || 0;
                });
              });
              averageScores = Object.keys(totals).reduce(
                (acc, key) => ({
                  ...acc,
                  [key]: totals[key as keyof typeof totals] / allScoresData.length,
                }),
                {} as typeof totals
              );
            }
          }
        }

        let feedbackQuery = supabase
          .from('assignment_feedback')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', enroll.student_id);

        if (selectedAssignment !== 'all') {
          feedbackQuery = feedbackQuery.eq('assignment_id', selectedAssignment);
        }

        const { count: feedbackCount } = await feedbackQuery;

        processedStudents.push({
          id: enroll.student_id,
          fullName,
          latestScores: averageScores,
          feedbackCount: feedbackCount || 0,
        });
      }

      setStudents(processedStudents);
      setAllStudents(allStudentsData);

      // Calculate class average or individual student scores based on filter
      if (selectedStudent !== 'all') {
        const student = processedStudents.find((s) => s.id === selectedStudent);
        setClassAverage(student?.latestScores || null);
      } else {
        const validScores = processedStudents.filter((s) => s.latestScores);
        if (validScores.length > 0) {
          const totals = { vision: 0, values: 0, thinking: 0, connection: 0, action: 0 };
          validScores.forEach((s) => {
            if (s.latestScores) {
              Object.keys(totals).forEach((key) => {
                totals[key as keyof typeof totals] += s.latestScores![key as keyof typeof totals];
              });
            }
          });
          const avg = Object.keys(totals).reduce(
            (acc, key) => ({
              ...acc,
              [key]: totals[key as keyof typeof totals] / validScores.length,
            }),
            {} as typeof totals
          );
          setClassAverage(avg);
        } else {
          setClassAverage(null);
        }
      }
    } catch (error) {
      // toast.error('Error loading analytics');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      hasFetchedRef.current = true;
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Filters Section */}
      <Card className="rounded-[32px] border-none shadow-lg bg-white dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-800 dark:text-slate-100">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl">
              <Filter className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            {t('analytics.filtersTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-300 ml-1 flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('analytics.filterByStudent')}
              </label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-700 p-1">
                  <SelectItem value="all" className="rounded-xl cursor-pointer">{t('analytics.all')}</SelectItem>
                  {allStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="rounded-xl cursor-pointer">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-300 ml-1 flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {t('analytics.filterByAssignment')}
              </label>
              <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-700 p-1">
                  <SelectItem value="all" className="rounded-xl cursor-pointer">{t('analytics.allAssignments')}</SelectItem>
                  {assignments.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="rounded-xl cursor-pointer">
                      {a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[28px] border-none shadow-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:scale-150 transition-transform duration-500" />
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-blue-100 flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('analytics.totalStudents')}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold">{studentCount}</div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-none shadow-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:scale-150 transition-transform duration-500" />
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-emerald-100 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {t('analytics.assignments')}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold">{assignmentCount}</div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-none shadow-md bg-gradient-to-br from-amber-500 to-orange-600 text-white overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:scale-150 transition-transform duration-500" />
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-amber-100 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('analytics.totalSubmissions')}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold">
              {students.reduce((s, st) => s + st.feedbackCount, 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-none shadow-md bg-gradient-to-br from-purple-500 to-pink-600 text-white overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:scale-150 transition-transform duration-500" />
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-purple-100 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {t('analytics.completionRate')}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold">
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
            <Card className="rounded-[32px] border-none shadow-lg bg-white dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
                        <BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                      </div>
                      {selectedStudent === 'all' ? t('analytics.classAverage') : allStudents.find((s) => s.id === selectedStudent)?.name}
                    </CardTitle>
                    <CardDescription className="mt-1 ml-11">
                      {selectedAssignment === 'all'
                        ? 'Average 5D scores across all submissions'
                        : `Scores for ${assignments.find((a) => a.id === selectedAssignment)?.title}`}
                    </CardDescription>
                  </div>
                  {selectedStudent === 'all' && (
                    <Badge variant="secondary" className="rounded-full px-4 py-1 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                      Class Overview
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
                title="Content Related Abilities (CRA)"
                description={
                  selectedStudent !== 'all'
                    ? `Hard skills assessment for ${allStudents.find((s) => s.id === selectedStudent)?.name}`
                    : `Hard skills assessments for ${assignments.find((a) => a.id === selectedAssignment)?.title}`
                }
              />
            </div>
          )}

          {/* All Students List (Collapsible) */}
          {selectedStudent === 'all' && selectedAssignment === 'all' && (
            <Card className="rounded-[32px] border-none shadow-lg bg-white dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-6">
                <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Student Performance Overview
                </CardTitle>
                <CardDescription className="ml-11">
                  Detailed breakdown by student
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {students.filter((s) => s.latestScores).length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-slate-500">No student data available yet</p>
                  </div>
                ) : (
                  students
                    .filter((s) => s.latestScores)
                    .map((student) => (
                      <Collapsible key={student.id} className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-5 h-auto hover:bg-transparent"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                                {student.fullName.charAt(0)}
                              </div>
                              <span className="font-semibold text-slate-700 dark:text-slate-300 text-base">{student.fullName}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="rounded-full bg-white dark:bg-slate-900">
                                {student.feedbackCount} submissions
                              </Badge>
                              <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200" />
                            </div>
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-5 pb-5 space-y-6 bg-white dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                          {/* Student's Average 5D Chart */}
                          <div className="pt-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                              <Sparkles className="h-3 w-3" />
                              Average 5D Profile
                            </h4>
                            <FiveDChart scores={student.latestScores!} explanations={null} />
                          </div>

                          {/* Student's CRA Table */}
                          <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                            <HardSkillsAssessmentTable
                              studentId={student.id}
                              assignmentId="all"
                              classroomId={classroomId}
                              title="Content Related Abilities (CRA)"
                              description={`All hard skills assessments across all assignments`}
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
            <Card className="rounded-[32px] border-none shadow-lg bg-white dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-6">
                <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                    <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Content Related Abilities (CRA)
                </CardTitle>
                <CardDescription className="ml-11">
                  Hard skills assessments for all students on{' '}
                  {assignments.find((a) => a.id === selectedAssignment)?.title}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {allStudents.map((student) => (
                  <Collapsible key={student.id} className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-5 h-auto hover:bg-slate-100 dark:hover:bg-slate-800/50">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 font-bold text-sm">
                            {student.name.charAt(0)}
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 text-base">{student.name}</span>
                        </div>
                        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-5 pb-5 bg-white dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 pt-4">
                      <HardSkillsAssessmentTable
                        studentId={student.id}
                        assignmentId={selectedAssignment}
                        classroomId={classroomId}
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
          <Card className="rounded-[32px] border-none shadow-lg bg-white dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden sticky top-6">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 pb-6">
              <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                  <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                {t('analytics.performanceSummary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {t('analytics.activeStudents')}
                    </p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {students.filter((s) => s.feedbackCount > 0).length} <span className="text-sm text-slate-400 font-normal">/ {studentCount}</span>
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                    <Users className="h-5 w-5" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {t('analytics.avgSubmissions')}
                    </p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {studentCount > 0
                        ? (
                          students.reduce((sum, s) => sum + s.feedbackCount, 0) / studentCount
                        ).toFixed(1)
                        : 0}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                    <FileText className="h-5 w-5" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {t('analytics.engagementRate')}
                    </p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {studentCount > 0
                        ? Math.round(
                          (students.filter((s) => s.feedbackCount > 0).length / studentCount) * 100
                        )
                        : 0}
                      %
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
              </div>

              {students.filter((s) => s.latestScores).length > 0 && (
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                    {t('analytics.average5D')}
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(classAverage || {}).map(([dimension, score]) => (
                      <div key={dimension} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 capitalize">
                          {t(`submissionDetail.dimensions.${dimension}`)}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${(score / 10) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 w-8 text-right">
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
