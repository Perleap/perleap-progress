import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";
import { AssignmentChatInterface } from "@/components/AssignmentChatInterface";

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  due_at: string;
  type: string;
  target_dimensions: {
    cognitive: boolean;
    emotional: boolean;
    social: boolean;
    creative: boolean;
    behavioral: boolean;
  };
  classrooms: {
    name: string;
    teacher_profiles: {
      full_name: string;
    } | null;
  };
}

interface Submission {
  id: string;
  text_body: string;
  submitted_at: string;
}

interface Feedback {
  student_feedback: string;
  teacher_feedback: string;
  created_at: string;
}

const AssignmentDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
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
      // Fetch assignment with teacher info
      const { data: assignmentData, error: assignError } = await supabase
        .from('assignments')
        .select('*, classrooms(name, teacher_id)')
        .eq('id', id)
        .maybeSingle();

      if (assignError) throw assignError;
      
      if (!assignmentData) {
        toast.error("Assignment not found");
        navigate('/student/dashboard');
        return;
      }

      // Fetch teacher profile separately
      let teacherName = 'Teacher';
      if (assignmentData.classrooms?.teacher_id) {
        const { data: teacherProfile } = await supabase
          .from('teacher_profiles')
          .select('full_name')
          .eq('user_id', assignmentData.classrooms.teacher_id)
          .maybeSingle();
        
        if (teacherProfile?.full_name) {
          teacherName = teacherProfile.full_name;
        }
      }

      setAssignment({
        ...assignmentData,
        classrooms: {
          ...assignmentData.classrooms,
          teacher_profiles: { full_name: teacherName }
        }
      } as any);

      // Check for existing submission
      const { data: submissionData } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', id)
        .eq('student_id', user?.id)
        .maybeSingle();

      if (submissionData) {
        setSubmission(submissionData);
        
        // Check for feedback
        const { data: feedbackData } = await supabase
          .from('assignment_feedback')
          .select('*')
          .eq('submission_id', submissionData.id)
          .maybeSingle();
        
        if (feedbackData) {
          setFeedback(feedbackData);
        }
      } else {
        // Create initial submission for this assignment
        const { data: newSubmission, error: subError } = await supabase
          .from('submissions')
          .insert({
            assignment_id: id!,
            student_id: user!.id,
            text_body: ''
          })
          .select()
          .single();

        if (subError) throw subError;
        setSubmission(newSubmission);
      }
    } catch (error: any) {
      console.error("Error loading assignment:", error);
      toast.error("Error loading assignment");
      navigate('/student/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleActivityComplete = () => {
    fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!assignment) return null;

  const targetDimensions = Object.entries(assignment.target_dimensions)
    .filter(([_, value]) => value)
    .map(([key]) => key);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 md:h-16 items-center gap-2 md:gap-4 px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-2xl font-bold truncate">{assignment.title}</h1>
            <p className="text-xs md:text-sm text-muted-foreground truncate">{assignment.classrooms.name}</p>
          </div>
        </div>
      </header>

      <main className="container py-4 md:py-8 px-4 max-w-4xl">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Assignment Details
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <Calendar className="h-4 w-4" />
                    {assignment.due_at && `Due: ${new Date(assignment.due_at).toLocaleString()}`}
                  </CardDescription>
                </div>
                <Badge variant="secondary">{assignment.type.replace('_', ' ')}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Instructions</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{assignment.instructions}</p>
              </div>

              {targetDimensions.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Learning Dimensions</h3>
                  <div className="flex flex-wrap gap-2">
                    {targetDimensions.map((dimension) => (
                      <Badge key={dimension} variant="outline" className="capitalize">
                        {dimension}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {!feedback && submission && (
            <AssignmentChatInterface
              assignmentId={assignment.id}
              assignmentTitle={assignment.title}
              teacherName={assignment.classrooms.teacher_profiles?.full_name || 'Teacher'}
              assignmentInstructions={assignment.instructions}
              submissionId={submission.id}
              onComplete={handleActivityComplete}
            />
          )}

          {feedback && (
            <Card className="border-primary/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-primary">🎉 Your Feedback</CardTitle>
                <CardDescription>
                  Completed on {new Date(feedback.created_at).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  {feedback.student_feedback
                    ?.replace(/\*\*/g, '')
                    ?.replace(/\/\//g, '')
                    ?.trim()}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default AssignmentDetail;
