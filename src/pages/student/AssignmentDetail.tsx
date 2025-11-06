import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Calendar, FileText, Send } from "lucide-react";
import { toast } from "sonner";

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
  };
}

interface Submission {
  id: string;
  text_body: string;
  submitted_at: string;
}

const AssignmentDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [textBody, setTextBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchData();
  }, [id, user]);

  const fetchData = async () => {
    try {
      // Fetch assignment
      const { data: assignmentData, error: assignError } = await supabase
        .from('assignments')
        .select('*, classrooms(name)')
        .eq('id', id)
        .maybeSingle();

      if (assignError) throw assignError;
      
      if (!assignmentData) {
        toast.error("Assignment not found");
        navigate('/student/dashboard');
        return;
      }

      setAssignment(assignmentData as any);

      // Check for existing submission
      const { data: submissionData } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', id)
        .eq('student_id', user?.id)
        .maybeSingle();

      if (submissionData) {
        setSubmission(submissionData);
        setTextBody(submissionData.text_body || "");
      }
    } catch (error: any) {
      console.error("Error loading assignment:", error);
      toast.error("Error loading assignment");
      navigate('/student/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!textBody.trim()) {
      toast.error("Please enter your submission");
      return;
    }

    setSubmitting(true);
    try {
      if (submission) {
        // Update existing submission
        const { error } = await supabase
          .from('submissions')
          .update({
            text_body: textBody,
            submitted_at: new Date().toISOString()
          })
          .eq('id', submission.id);

        if (error) throw error;
        toast.success("Submission updated successfully!");
      } else {
        // Create new submission
        const { error } = await supabase
          .from('submissions')
          .insert({
            assignment_id: id!,
            student_id: user!.id,
            text_body: textBody
          });

        if (error) throw error;
        toast.success("Assignment submitted successfully!");
      }

      await fetchData();
    } catch (error: any) {
      console.error("Error submitting assignment:", error);
      toast.error("Error submitting assignment. Please try again.");
    } finally {
      setSubmitting(false);
    }
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
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{assignment.title}</h1>
            <p className="text-sm text-muted-foreground">{assignment.classrooms.name}</p>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-4xl">
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

          <Card>
            <CardHeader>
              <CardTitle>Your Submission</CardTitle>
              <CardDescription>
                {submission 
                  ? `Last submitted: ${new Date(submission.submitted_at).toLocaleString()}` 
                  : "Submit your work below"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="submission">Your Answer</Label>
                <Textarea
                  id="submission"
                  placeholder="Type your answer here..."
                  rows={10}
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                {submitting ? (
                  "Submitting..."
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {submission ? "Update Submission" : "Submit Assignment"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AssignmentDetail;
