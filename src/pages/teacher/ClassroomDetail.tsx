import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Users, BookOpen, Calendar, Plus, Edit, BarChart3, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { EditClassroomDialog } from "@/components/EditClassroomDialog";
import { CreateAssignmentDialog } from "@/components/CreateAssignmentDialog";
import { EditAssignmentDialog } from "@/components/EditAssignmentDialog";
import { ClassroomAnalytics } from "@/components/ClassroomAnalytics";
import { SubmissionsTab } from "@/components/SubmissionsTab";
import { RegenerateScoresButton } from "@/components/RegenerateScoresButton";

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

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  type: string;
  status: string;
  due_at: string;
}

interface EnrolledStudent {
  id: string;
  created_at: string;
  student_profiles: {
    full_name: string;
  } | null;
}

const ClassroomDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [editAssignmentDialogOpen, setEditAssignmentDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

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
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("Classroom not found");
        navigate('/teacher/dashboard');
        return;
      }
      setClassroom(data);
      await fetchAssignments();
      await fetchStudents();
    } catch (error: any) {
      console.error("Error loading classroom:", error);
      toast.error("Error loading classroom");
      navigate('/teacher/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('classroom_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error: any) {
      console.error("Error loading assignments:", error);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select('id, created_at, student_id')
        .eq('classroom_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (!enrollments || enrollments.length === 0) {
        setStudents([]);
        return;
      }

      // Fetch student profiles separately
      const studentIds = enrollments.map(e => e.student_id);
      const { data: profiles } = await supabase
        .from('student_profiles')
        .select('user_id, full_name')
        .in('user_id', studentIds);

      // Combine the data
      const studentsWithProfiles = enrollments.map(enrollment => ({
        id: enrollment.id,
        created_at: enrollment.created_at,
        student_profiles: profiles?.find(p => p.user_id === enrollment.student_id) || null,
      }));

      setStudents(studentsWithProfiles);
    } catch (error: any) {
      console.error("Error loading students:", error);
    }
  };

  const deleteAssignment = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to delete this assignment?")) return;

    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
      toast.success("Assignment deleted");
      fetchAssignments();
    } catch (error: any) {
      toast.error("Error deleting assignment");
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

      <main className="container py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Classroom Overview</h2>
              <Button onClick={() => setEditDialogOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Information
              </Button>
            </div>

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
                        {classroom.learning_outcomes.map((outcome: string, index: number) => (
                          <li key={index}>{outcome}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {classroom.key_challenges && classroom.key_challenges.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-1">Key Challenges</h3>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        {classroom.key_challenges.map((challenge: string, index: number) => (
                          <li key={index}>{challenge}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="assignments" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Assignments</h2>
                <p className="text-muted-foreground">Create and manage assignments</p>
              </div>
              <Button onClick={() => setAssignmentDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Assignment
              </Button>
            </div>

            {assignments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No assignments yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first assignment to get started</p>
                  <Button onClick={() => setAssignmentDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Assignment
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {assignments.map((assignment) => (
                  <Card key={assignment.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{assignment.title}</CardTitle>
                          <CardDescription className="mt-2">
                            Type: {assignment.type.replace('_', ' ')} • 
                            {assignment.due_at && ` Due: ${new Date(assignment.due_at).toLocaleString()}`}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={assignment.status === 'published' ? 'default' : 'secondary'}>
                            {assignment.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAssignment(assignment);
                              setEditAssignmentDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAssignment(assignment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{assignment.instructions}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Enrolled Students</h2>
                <p className="text-muted-foreground">View and manage your students</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Students ({students.filter(s => s.student_profiles?.full_name).length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {students.filter(s => s.student_profiles?.full_name).length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No students enrolled yet</p>
                ) : (
                  <div className="space-y-3">
                    {students.filter(enrollment => enrollment.student_profiles?.full_name).map((enrollment) => (
                      <div key={enrollment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">
                            {enrollment.student_profiles?.full_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Joined: {new Date(enrollment.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submissions" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Student Submissions</h2>
              <p className="text-muted-foreground">View completed assignments and feedback</p>
            </div>
            <SubmissionsTab classroomId={id!} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                <h2 className="text-2xl font-bold">Analytics</h2>
              </div>
              <RegenerateScoresButton 
                classroomId={id!} 
                onComplete={fetchClassroom}
              />
            </div>
            <ClassroomAnalytics classroomId={id!} />
          </TabsContent>
        </Tabs>
      </main>

      <EditClassroomDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        classroom={classroom!}
        onSuccess={fetchClassroom}
      />

      <CreateAssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        classroomId={id!}
        onSuccess={fetchAssignments}
      />

      {selectedAssignment && (
        <EditAssignmentDialog
          open={editAssignmentDialogOpen}
          onOpenChange={setEditAssignmentDialogOpen}
          assignment={selectedAssignment}
          onSuccess={fetchAssignments}
        />
      )}
    </div>
  );
};

export default ClassroomDetail;
