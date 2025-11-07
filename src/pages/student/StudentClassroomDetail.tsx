import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, BookOpen, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";
import { FiveDChartCard } from "@/components/FiveDChart";

interface Classroom {
  id: string;
  name: string;
  subject: string;
  course_title: string;
  course_duration: string;
  start_date: string;
  end_date: string;
  course_outline: string;
  resources: string;
  learning_outcomes: string[];
  key_challenges: string[];
}

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  due_at: string;
  status: string;
  type: string;
}

const StudentClassroomDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<{
    cognitive: number;
    emotional: number;
    social: number;
    creative: number;
    behavioral: number;
  } | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchData();
  }, [id, user]);

  const fetchData = async () => {
    try {
      // Check enrollment and fetch classroom
      const { data: enrollment, error: enrollError } = await supabase
        .from('enrollments')
        .select('classroom_id, classrooms(*)')
        .eq('student_id', user?.id)
        .eq('classroom_id', id)
        .maybeSingle();

      if (enrollError) throw enrollError;
      
      if (!enrollment) {
        toast.error("You're not enrolled in this classroom");
        navigate('/student/dashboard');
        return;
      }

      setClassroom(enrollment.classrooms as any);

      // Fetch assignments
      const { data: assignmentsData, error: assignError } = await supabase
        .from('assignments')
        .select('*')
        .eq('classroom_id', id)
        .eq('status', 'published')
        .order('due_at', { ascending: true });

      if (assignError) throw assignError;
      setAssignments(assignmentsData || []);

      // Fetch latest 5D snapshot
      const { data: snapshot } = await supabase
        .from('five_d_snapshots')
        .select('scores')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (snapshot?.scores) {
        setScores(snapshot.scores as any);
      } else {
        setScores(null);
      }
    } catch (error: any) {
      console.error("Error loading classroom:", error);
      toast.error("Error loading classroom details");
      navigate('/student/dashboard');
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
          <Button variant="ghost" size="sm" onClick={() => navigate('/student/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{classroom.name}</h1>
            <p className="text-sm text-muted-foreground">{classroom.subject}</p>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="assignments">Assignments</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
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
              </TabsContent>

              <TabsContent value="assignments" className="space-y-4">
                {assignments.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No assignments yet</h3>
                      <p className="text-muted-foreground">Check back later for new assignments</p>
                    </CardContent>
                  </Card>
                ) : (
                  assignments.map((assignment) => (
                    <Card 
                      key={assignment.id} 
                      className="hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => navigate(`/student/assignment/${assignment.id}`)}
                    >
                      <CardHeader>
                        <CardTitle>{assignment.title}</CardTitle>
                        <CardDescription>
                          Type: {assignment.type.replace('_', ' ')} • 
                          {assignment.due_at && ` Due: ${new Date(assignment.due_at).toLocaleString()}`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">{assignment.instructions}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div>
            {scores ? (
              <FiveDChartCard scores={scores} title="My Progress in this Class" />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>My Progress in this Class</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-center text-muted-foreground">
                    Your 5D growth profile will appear here once you complete and submit your first assignment.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentClassroomDetail;
