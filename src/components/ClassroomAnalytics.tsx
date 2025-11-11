import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { FiveDChart } from "./FiveDChart";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

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
  const [selectedAssignment, setSelectedAssignment] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  const [classAverage, setClassAverage] = useState<{
    vision: number;
    values: number;
    thinking: number;
    connection: number;
    action: number;
  } | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [classroomId, selectedAssignment, selectedStudent]);

  const fetchAnalytics = async () => {
    try {
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
      const allStudentsData: Array<{id: string, name: string}> = [];
      
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
            const submissionIds = submissions.map(s => s.id);
            
            const { data: snapshots } = await supabase
              .from('five_d_snapshots')
              .select('scores')
              .in('submission_id', submissionIds)
              .eq('classroom_id', classroomId)
              .neq('source', 'onboarding');

            if (snapshots && snapshots.length > 0) {
              const totals = { vision: 0, values: 0, thinking: 0, connection: 0, action: 0 };
              snapshots.forEach(snapshot => {
                const scores = snapshot.scores as any;
                Object.keys(totals).forEach(key => {
                  totals[key as keyof typeof totals] += scores[key] || 0;
                });
              });
              averageScores = Object.keys(totals).reduce((acc, key) => ({
                ...acc,
                [key]: totals[key as keyof typeof totals] / snapshots.length
              }), {} as typeof totals);
            }
          }
        } else {
          // For all assignments: get all scores for this classroom
          const { data: allScoresData } = await supabase
            .from('five_d_snapshots')
            .select('scores')
            .eq('user_id', enroll.student_id)
            .eq('classroom_id', classroomId)
            .neq('source', 'onboarding')
            .order('created_at', { ascending: false });

          if (allScoresData && allScoresData.length > 0) {
            const totals = { vision: 0, values: 0, thinking: 0, connection: 0, action: 0 };
            allScoresData.forEach(snapshot => {
              const scores = snapshot.scores as any;
              Object.keys(totals).forEach(key => {
                totals[key as keyof typeof totals] += scores[key] || 0;
              });
            });
            averageScores = Object.keys(totals).reduce((acc, key) => ({
              ...acc,
              [key]: totals[key as keyof typeof totals] / allScoresData.length
            }), {} as typeof totals);
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
          feedbackCount: feedbackCount || 0
        });
      }

      setStudents(processedStudents);
      setAllStudents(allStudentsData);

      // Calculate class average or individual student scores based on filter
      if (selectedStudent !== "all") {
        const student = processedStudents.find(s => s.id === selectedStudent);
        setClassAverage(student?.latestScores || null);
      } else {
        const validScores = processedStudents.filter(s => s.latestScores);
        if (validScores.length > 0) {
          const totals = { vision: 0, values: 0, thinking: 0, connection: 0, action: 0 };
          validScores.forEach(s => {
            if (s.latestScores) {
              Object.keys(totals).forEach(key => {
                totals[key as keyof typeof totals] += s.latestScores![key as keyof typeof totals];
              });
            }
          });
          const avg = Object.keys(totals).reduce((acc, key) => ({
            ...acc,
            [key]: totals[key as keyof typeof totals] / validScores.length
          }), {} as typeof totals);
          setClassAverage(avg);
        } else {
          setClassAverage(null);
        }
      }
    } catch (error) {
      toast.error('Error loading analytics');
    } finally{
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4 md:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">{t('analytics.filtersTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('analytics.filterByStudent')}</label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('analytics.all')}</SelectItem>
                  {allStudents.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t('analytics.filterByAssignment')}</label>
              <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('analytics.allAssignments')}</SelectItem>
                  {assignments.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs md:text-sm">{t('analytics.totalStudents')}</CardTitle></CardHeader>
          <CardContent><div className="text-xl md:text-2xl font-bold">{studentCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs md:text-sm">{t('analytics.assignments')}</CardTitle></CardHeader>
          <CardContent><div className="text-xl md:text-2xl font-bold">{assignmentCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs md:text-sm">{t('analytics.totalSubmissions')}</CardTitle></CardHeader>
          <CardContent><div className="text-xl md:text-2xl font-bold">{students.reduce((s, st) => s + st.feedbackCount, 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs md:text-sm">{t('analytics.completionRate')}</CardTitle></CardHeader>
          <CardContent><div className="text-xl md:text-2xl font-bold">{studentCount > 0 ? Math.round((students.filter(s => s.feedbackCount > 0).length / studentCount) * 100) : 0}%</div></CardContent></Card>
      </div>

      {classAverage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">
              {selectedStudent === "all" ? t('analytics.classAverage') : `${allStudents.find(s => s.id === selectedStudent)?.name} - ${t('analytics.profile5D')}`}
            </CardTitle>
            <CardDescription className="text-sm">
              {selectedStudent === "all" 
                ? t('analytics.averageScoresDesc')
                : t('analytics.individualProfile')}
            </CardDescription>
          </CardHeader>
          <CardContent><FiveDChart scores={classAverage} explanations={null} /></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">{t('analytics.classInsights')}</CardTitle>
          <CardDescription className="text-sm">{t('analytics.classInsightsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-2">{t('analytics.comingSoon')}</p>
            <p className="text-sm">{t('analytics.comingSoonDesc')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">{t('analytics.performanceSummary')}</CardTitle>
          <CardDescription className="text-sm">{t('analytics.performanceSummaryDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <p className="text-xs md:text-sm text-muted-foreground">{t('analytics.activeStudents')}</p>
                <p className="text-xl md:text-2xl font-bold">{students.filter(s => s.feedbackCount > 0).length} / {studentCount}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs md:text-sm text-muted-foreground">{t('analytics.avgSubmissions')}</p>
                <p className="text-xl md:text-2xl font-bold">
                  {studentCount > 0 ? (students.reduce((sum, s) => sum + s.feedbackCount, 0) / studentCount).toFixed(1) : 0}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs md:text-sm text-muted-foreground">{t('analytics.engagementRate')}</p>
                <p className="text-xl md:text-2xl font-bold">
                  {studentCount > 0 ? Math.round((students.filter(s => s.feedbackCount > 0).length / studentCount) * 100) : 0}%
                </p>
              </div>
            </div>
            
            {students.filter(s => s.latestScores).length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="text-sm md:text-base font-semibold mb-3">{t('analytics.average5D')}</h4>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
                  {Object.entries(classAverage || {}).map(([dimension, score]) => (
                    <div key={dimension} className="text-center p-2 md:p-3 bg-muted rounded-lg">
                      <p className="text-[10px] md:text-xs text-muted-foreground capitalize mb-1">{t(`submissionDetail.dimensions.${dimension}`)}</p>
                      <p className="text-base md:text-xl font-bold">{score.toFixed(1)}/10</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}