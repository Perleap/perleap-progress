import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Users, BookOpen, Calendar } from "lucide-react";
import { toast } from "sonner";

interface Classroom {
  id: string;
  name: string;
  subject: string;
  invite_code: string;
  course_title: string;
  course_duration: string;
  start_date: string;
  end_date: string;
  course_outline: string;
  resources: string;
  learning_outcomes: string[] | any;
  key_challenges: string[] | any;
}

const ClassroomDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchClassroom();
  }, [id, user]);

  const fetchClassroom = async () => {
    try {
      const { data, error } = await supabase
        .from('classrooms')
        .select('*')
        .eq('id', id)
        .eq('teacher_id', user?.id)
        .single();

      if (error) throw error;
      setClassroom(data);
    } catch (error: any) {
      console.error("Error loading classroom:", error);
      toast.error("Error loading classroom");
      navigate('/teacher/dashboard');
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

  if (!classroom) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{classroom.name}</h1>
            <p className="text-sm text-muted-foreground">{classroom.subject}</p>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Invite Code</CardTitle>
            <CardDescription>Share this code with students to join the classroom</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="text-2xl font-mono font-bold px-4 py-2 bg-muted rounded-lg">
                {classroom.invite_code}
              </code>
            </div>
          </CardContent>
        </Card>

        {classroom.course_title && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Course Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">Course Title</h3>
                <p className="text-muted-foreground">{classroom.course_title}</p>
              </div>
              
              {classroom.course_duration && (
                <div>
                  <h3 className="font-semibold mb-1">Duration</h3>
                  <p className="text-muted-foreground">{classroom.course_duration}</p>
                </div>
              )}

              {(classroom.start_date || classroom.end_date) && (
                <div>
                  <h3 className="font-semibold mb-1 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Course Dates
                  </h3>
                  <div className="text-muted-foreground">
                    {classroom.start_date && <p>Start: {new Date(classroom.start_date).toLocaleDateString()}</p>}
                    {classroom.end_date && <p>End: {new Date(classroom.end_date).toLocaleDateString()}</p>}
                  </div>
                </div>
              )}

              {classroom.course_outline && (
                <div>
                  <h3 className="font-semibold mb-1">Course Outline</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{classroom.course_outline}</p>
                </div>
              )}

              {classroom.resources && (
                <div>
                  <h3 className="font-semibold mb-1">Resources</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{classroom.resources}</p>
                </div>
              )}

              {classroom.learning_outcomes && classroom.learning_outcomes.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-1">Learning Outcomes</h3>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    {classroom.learning_outcomes.map((outcome, index) => (
                      <li key={index}>{outcome}</li>
                    ))}
                  </ul>
                </div>
              )}

              {classroom.key_challenges && classroom.key_challenges.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-1">Key Challenges</h3>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    {classroom.key_challenges.map((challenge, index) => (
                      <li key={index}>{challenge}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Students
            </CardTitle>
            <CardDescription>Student enrollment and progress</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Student list coming soon...</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
            <CardDescription>Create and manage assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Assignment management coming soon...</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ClassroomDetail;
