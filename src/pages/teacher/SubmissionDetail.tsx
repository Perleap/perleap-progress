import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Submission {
  id: string;
  submitted_at: string;
  student_id: string;
  assignment_id: string;
  assignments: {
    title: string;
    classrooms: {
      name: string;
    };
  };
}

interface Feedback {
  student_feedback: string;
  teacher_feedback: string;
  created_at: string;
  conversation_context: any;
}

const SubmissionDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchData();
  }, [id, user]);

  const fetchData = async () => {
    try {
      // Fetch submission with assignment info
      const { data: submissionData, error: subError } = await supabase
        .from('submissions')
        .select('*, assignments(title, classroom_id, classrooms(name, teacher_id))')
        .eq('id', id)
        .single();

      if (subError) throw subError;
      if (!submissionData) {
        toast.error("Submission not found");
        navigate(-1);
        return;
      }

      // Check if this teacher owns the classroom
      const teacherId = (submissionData.assignments as any).classrooms.teacher_id;
      if (teacherId !== user?.id) {
        toast.error("You don't have access to this submission");
        navigate(-1);
        return;
      }

      setSubmission(submissionData as any);

      // Fetch student name
      const { data: studentProfile } = await supabase
        .from('student_profiles')
        .select('full_name')
        .eq('user_id', submissionData.student_id)
        .single();

      setStudentName(studentProfile?.full_name || 'Unknown Student');

      // Fetch feedback
      const { data: feedbackData } = await supabase
        .from('assignment_feedback')
        .select('*')
        .eq('submission_id', id)
        .maybeSingle();

      if (feedbackData) {
        setFeedback(feedbackData);
      }
    } catch (error: any) {
      console.error("Error loading submission:", error);
      toast.error("Error loading submission");
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!submission) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{studentName}'s Submission</h1>
            <p className="text-sm text-muted-foreground">
              {(submission.assignments as any).title}
            </p>
          </div>
          <Badge variant="secondary">
            {new Date(submission.submitted_at).toLocaleDateString()}
          </Badge>
        </div>
      </header>

      <main className="container py-8 max-w-5xl">
        <div className="space-y-6">
          {feedback && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Conversation History
                  </CardTitle>
                  <CardDescription>
                    Complete conversation between {studentName} and Perleap
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {Array.isArray(feedback.conversation_context) && feedback.conversation_context.map((msg: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-primary/10 ml-8'
                            : 'bg-muted mr-8'
                        }`}
                      >
                        <div className="font-semibold mb-1 text-sm">
                          {msg.role === 'user' ? studentName : 'Perleap'}
                        </div>
                        <div className="text-sm whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Feedback for Teacher</CardTitle>
                  <CardDescription>
                    AI-generated insights about {studentName}'s learning
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none text-muted-foreground">
                    {feedback.teacher_feedback
                      ?.replace(/\*\*/g, '')
                      ?.replace(/\/\//g, '')
                      ?.trim() || 'No teacher feedback generated'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Feedback Given to Student</CardTitle>
                  <CardDescription>
                    What {studentName} saw after completing the assignment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none text-muted-foreground">
                    {feedback.student_feedback
                      ?.replace(/\*\*/g, '')
                      ?.replace(/\/\//g, '')
                      ?.trim()}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {!feedback && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No feedback yet</h3>
                <p className="text-muted-foreground text-center">
                  This student hasn't completed the assignment yet
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default SubmissionDetail;
