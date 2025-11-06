import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Eye } from "lucide-react";

interface SubmissionsTabProps {
  classroomId: string;
}

interface SubmissionWithDetails {
  id: string;
  submitted_at: string;
  student_id: string;
  assignment_id: string;
  student_name: string;
  assignment_title: string;
  has_feedback: boolean;
}

export function SubmissionsTab({ classroomId }: SubmissionsTabProps) {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubmissions();
  }, [classroomId]);

  const fetchSubmissions = async () => {
    try {
      // Get all assignments in this classroom
      const { data: assignments } = await supabase
        .from('assignments')
        .select('id')
        .eq('classroom_id', classroomId);

      if (!assignments || assignments.length === 0) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      const assignmentIds = assignments.map(a => a.id);

      // Get all submissions for these assignments
      const { data: submissionsData } = await supabase
        .from('submissions')
        .select('id, submitted_at, student_id, assignment_id')
        .in('assignment_id', assignmentIds)
        .order('submitted_at', { ascending: false });

      if (!submissionsData) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      // Fetch student names and assignment titles
      const enrichedSubmissions: SubmissionWithDetails[] = [];
      
      for (const sub of submissionsData) {
        const { data: student } = await supabase
          .from('student_profiles')
          .select('full_name')
          .eq('user_id', sub.student_id)
          .single();

        const { data: assignment } = await supabase
          .from('assignments')
          .select('title')
          .eq('id', sub.assignment_id)
          .single();

        const { data: feedback } = await supabase
          .from('assignment_feedback')
          .select('id')
          .eq('submission_id', sub.id)
          .maybeSingle();

        enrichedSubmissions.push({
          ...sub,
          student_name: student?.full_name || 'Unknown',
          assignment_title: assignment?.title || 'Unknown Assignment',
          has_feedback: !!feedback
        });
      }

      setSubmissions(enrichedSubmissions);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No submissions yet</h3>
          <p className="text-muted-foreground">
            Student submissions will appear here when they complete assignments
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => (
        <Card key={submission.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{submission.student_name}</CardTitle>
                <CardDescription>
                  {submission.assignment_title}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={submission.has_feedback ? 'default' : 'secondary'}>
                  {submission.has_feedback ? 'Completed' : 'In Progress'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/teacher/submission/${submission.id}`)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Submitted: {new Date(submission.submitted_at).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
