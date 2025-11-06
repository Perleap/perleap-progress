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

export function ClassroomAnalytics({ classroomId }: ClassroomAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [studentCount, setStudentCount] = useState(0);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("all");
  const [classAverage, setClassAverage] = useState<{
    cognitive: number;
    emotional: number;
    social: number;
    creative: number;
    behavioral: number;
  } | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [classroomId, selectedAssignment]);

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
      for (const enroll of enrollments || []) {
        const { data: profile } = await supabase
          .from('student_profiles')
          .select('full_name')
          .eq('user_id', enroll.student_id)
          .single();

        // Only get scores that are NOT from onboarding (to exclude baseline 2.5 scores)
        const { data: scoresData } = await supabase
          .from('five_d_snapshots')
          .select('scores, source')
          .eq('user_id', enroll.student_id)
          .neq('source', 'onboarding')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

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
          fullName: profile?.full_name || 'Unknown',
          latestScores: scoresData?.scores as any || null,
          feedbackCount: feedbackCount || 0
        });
      }

      setStudents(processedStudents);

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
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <label className="text-sm font-medium">Filter by Assignment</label>
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

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Students</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{studentCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Assignments</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{assignmentCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Submissions</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{students.reduce((s, st) => s + st.feedbackCount, 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Completion Rate</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{studentCount > 0 ? Math.round((students.filter(s => s.feedbackCount > 0).length / studentCount) * 100) : 0}%</div></CardContent></Card>
      </div>

      {classAverage && (
        <Card><CardHeader><CardTitle>Class Average - 5D Profile</CardTitle></CardHeader>
          <CardContent><FiveDChart scores={classAverage} /></CardContent></Card>
      )}

      <Card><CardHeader><CardTitle>Student Profiles</CardTitle></CardHeader>
        <CardContent><div className="grid gap-4">
          {students.filter(s => s.latestScores).map(s => (
            <Card key={s.id}><CardHeader><div className="flex justify-between"><CardTitle className="text-lg">{s.fullName}</CardTitle>
              <Badge variant="secondary">{s.feedbackCount} submissions</Badge></div></CardHeader>
              <CardContent><FiveDChart scores={s.latestScores!} /></CardContent></Card>
          ))}
          {students.filter(s => s.latestScores).length === 0 && (
            <p className="text-center text-muted-foreground py-8">No student progress data yet. Students will appear here after completing assignments.</p>
          )}
        </div></CardContent></Card>
    </div>
  );
}