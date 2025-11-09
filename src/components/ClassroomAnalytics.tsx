import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { FiveDChart } from "./FiveDChart";
import { Badge } from "@/components/ui/badge";

interface ClassroomAnalyticsProps {
  classroomId: string;
}

interface StudentData {
  id: string;
  fullName: string;
  latestScores: {
    cognitive: number;
    emotional: number;
    social: number;
    creative: number;
    behavioral: number;
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
  const [loading, setLoading] = useState(true);
  const [studentCount, setStudentCount] = useState(0);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [allStudents, setAllStudents] = useState<AllStudentsInfo[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  const [classAverage, setClassAverage] = useState<{
    cognitive: number;
    emotional: number;
    social: number;
    creative: number;
    behavioral: number;
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
              const totals = { cognitive: 0, emotional: 0, social: 0, creative: 0, behavioral: 0 };
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
            const totals = { cognitive: 0, emotional: 0, social: 0, creative: 0, behavioral: 0 };
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
          const totals = { cognitive: 0, emotional: 0, social: 0, creative: 0, behavioral: 0 };
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
          <CardTitle className="text-base md:text-lg">Analytics Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Filter by Student</label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {allStudents.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Filter by Assignment</label>
              <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignments</SelectItem>
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
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs md:text-sm">Total Students</CardTitle></CardHeader>
          <CardContent><div className="text-xl md:text-2xl font-bold">{studentCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs md:text-sm">Assignments</CardTitle></CardHeader>
          <CardContent><div className="text-xl md:text-2xl font-bold">{assignmentCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs md:text-sm">Total Submissions</CardTitle></CardHeader>
          <CardContent><div className="text-xl md:text-2xl font-bold">{students.reduce((s, st) => s + st.feedbackCount, 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs md:text-sm">Completion Rate</CardTitle></CardHeader>
          <CardContent><div className="text-xl md:text-2xl font-bold">{studentCount > 0 ? Math.round((students.filter(s => s.feedbackCount > 0).length / studentCount) * 100) : 0}%</div></CardContent></Card>
      </div>

      {classAverage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">
              {selectedStudent === "all" ? "Class Average - 5D Profile" : `${allStudents.find(s => s.id === selectedStudent)?.name} - 5D Profile`}
            </CardTitle>
            <CardDescription className="text-sm">
              {selectedStudent === "all" 
                ? "Average scores across all students with data"
                : "Individual student performance profile"}
            </CardDescription>
          </CardHeader>
          <CardContent><FiveDChart scores={classAverage} /></CardContent>
        </Card>
      )}

      <Card><CardHeader><CardTitle className="text-base md:text-lg">Student Profiles</CardTitle><CardDescription className="text-sm">Individual student progress and feedback analytics</CardDescription></CardHeader>
        <CardContent><div className="grid gap-4">
          {students.filter(s => s.latestScores).map(s => (
            <Card key={s.id}><CardHeader><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"><CardTitle className="text-base md:text-lg">{s.fullName}</CardTitle>
              <Badge variant="secondary" className="text-xs">{s.feedbackCount} submissions</Badge></div></CardHeader>
              <CardContent><FiveDChart scores={s.latestScores!} /></CardContent></Card>
          ))}
          {students.filter(s => s.latestScores).length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No student progress data yet. Students will appear here after completing assignments.</p>
          )}
        </div></CardContent></Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Class Performance Summary</CardTitle>
          <CardDescription className="text-sm">Overall statistics and completion rates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <p className="text-xs md:text-sm text-muted-foreground">Active Students</p>
                <p className="text-xl md:text-2xl font-bold">{students.filter(s => s.feedbackCount > 0).length} / {studentCount}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs md:text-sm text-muted-foreground">Average Submissions per Student</p>
                <p className="text-xl md:text-2xl font-bold">
                  {studentCount > 0 ? (students.reduce((sum, s) => sum + s.feedbackCount, 0) / studentCount).toFixed(1) : 0}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs md:text-sm text-muted-foreground">Class Engagement Rate</p>
                <p className="text-xl md:text-2xl font-bold">
                  {studentCount > 0 ? Math.round((students.filter(s => s.feedbackCount > 0).length / studentCount) * 100) : 0}%
                </p>
              </div>
            </div>
            
            {students.filter(s => s.latestScores).length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="text-sm md:text-base font-semibold mb-3">Average 5D Scores</h4>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
                  {Object.entries(classAverage || {}).map(([dimension, score]) => (
                    <div key={dimension} className="text-center p-2 md:p-3 bg-muted rounded-lg">
                      <p className="text-[10px] md:text-xs text-muted-foreground capitalize mb-1">{dimension}</p>
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