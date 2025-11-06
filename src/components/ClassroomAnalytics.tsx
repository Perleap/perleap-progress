import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, BookOpen, TrendingUp, Award } from "lucide-react";
import { FiveDChartCard } from "./FiveDChart";

interface ClassroomAnalyticsProps {
  classroomId: string;
}

interface StudentData {
  id: string;
  full_name: string;
  latest_scores: {
    cognitive: number;
    emotional: number;
    social: number;
    creative: number;
    behavioral: number;
  } | null;
}

export function ClassroomAnalytics({ classroomId }: ClassroomAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [studentCount, setStudentCount] = useState(0);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [classAverage, setClassAverage] = useState({
    cognitive: 0,
    emotional: 0,
    social: 0,
    creative: 0,
    behavioral: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, [classroomId]);

  const fetchAnalytics = async () => {
    try {
      // Fetch student count and enrollments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('classroom_id', classroomId);

      setStudentCount(enrollments?.length || 0);

      // Fetch assignment count
      const { data: assignments } = await supabase
        .from('assignments')
        .select('id')
        .eq('classroom_id', classroomId);

      setAssignmentCount(assignments?.length || 0);

      // Fetch student profiles and latest scores
      if (enrollments && enrollments.length > 0) {
        const studentIds = enrollments.map(e => e.student_id);
        
        const { data: profiles } = await supabase
          .from('student_profiles')
          .select('user_id, full_name')
          .in('user_id', studentIds);

        // Fetch latest 5D scores for each student
        const studentsWithScores = await Promise.all(
          (profiles || []).map(async (profile) => {
            const { data: snapshot } = await supabase
              .from('five_d_snapshots')
              .select('scores')
              .eq('user_id', profile.user_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            return {
              id: profile.user_id,
              full_name: profile.full_name || 'Student',
              latest_scores: snapshot?.scores as any || null,
            };
          })
        );

        setStudents(studentsWithScores);

        // Calculate class average
        const validScores = studentsWithScores.filter(s => s.latest_scores);
        if (validScores.length > 0) {
          const avg = {
            cognitive: 0,
            emotional: 0,
            social: 0,
            creative: 0,
            behavioral: 0,
          };

          validScores.forEach(student => {
            if (student.latest_scores) {
              Object.keys(avg).forEach(key => {
                avg[key as keyof typeof avg] += student.latest_scores[key as keyof typeof student.latest_scores];
              });
            }
          });

          Object.keys(avg).forEach(key => {
            avg[key as keyof typeof avg] = avg[key as keyof typeof avg] / validScores.length;
          });

          setClassAverage(avg);
        }
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-3xl font-bold">{studentCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <span className="text-3xl font-bold">{assignmentCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Engagement Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <span className="text-3xl font-bold">85%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completion Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-muted-foreground" />
              <span className="text-3xl font-bold">78%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class Average - 5D Profile</CardTitle>
          <CardDescription>Average scores across all enrolled students</CardDescription>
        </CardHeader>
        <CardContent>
          <FiveDChartCard scores={classAverage} title="" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Student Growth Profiles</CardTitle>
          <CardDescription>Individual 5D scores for each student</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {students.map((student) => (
              <div key={student.id} className="border-b pb-4 last:border-0">
                <h4 className="font-semibold mb-3">{student.full_name}</h4>
                {student.latest_scores ? (
                  <div className="grid grid-cols-5 gap-2 text-sm">
                    {Object.entries(student.latest_scores).map(([key, value]) => (
                      <div key={key} className="text-center">
                        <div className="font-medium capitalize text-xs text-muted-foreground mb-1">{key}</div>
                        <div className="font-bold">{value.toFixed(1)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                )}
              </div>
            ))}
            {students.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No students enrolled yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
