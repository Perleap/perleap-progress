import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { LogOut, Plus, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { FiveDChartCard } from "@/components/FiveDChart";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Assignment {
  id: string;
  title: string;
  due_at: string;
  classrooms: {
    name: string;
  };
}

interface Classroom {
  id: string;
  name: string;
  subject: string;
  classrooms: {
    invite_code: string;
  };
}

const StudentDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scores, setScores] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
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
      }

      // Fetch enrollments and classrooms
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('classroom_id, classrooms(id, name, subject, invite_code)')
        .eq('student_id', user?.id);

      if (enrollments && enrollments.length > 0) {
        const classroomIds = enrollments.map(e => e.classroom_id);
        
        // Set classrooms list
        const classroomsList = enrollments.map(e => ({
          id: e.classroom_id,
          name: e.classrooms.name,
          subject: e.classrooms.subject,
          classrooms: {
            invite_code: e.classrooms.invite_code
          }
        }));
        setClassrooms(classroomsList);

        // Fetch assignments
        const { data: assignmentsData } = await supabase
          .from('assignments')
          .select('*, classrooms(name)')
          .in('classroom_id', classroomIds)
          .eq('status', 'published')
          .order('due_at', { ascending: true });

        setAssignments(assignmentsData || []);
      } else {
        setClassrooms([]);
        setAssignments([]);
      }
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const joinClassroom = async () => {
    if (!user || !inviteCode.trim()) {
      toast.error("Please enter an invite code");
      return;
    }

    setJoining(true);
    try {
      const trimmedCode = inviteCode.trim().toUpperCase();
      console.log("Attempting to join with code:", trimmedCode);
      
      // Check if classroom exists - use a simpler query that bypasses RLS
      const { data: classroom, error: classroomError } = await supabase
        .from('classrooms')
        .select('id, name, invite_code')
        .eq('invite_code', trimmedCode)
        .maybeSingle();

      console.log("Classroom query result:", { classroom, error: classroomError });

      if (classroomError) {
        console.error("Error finding classroom:", classroomError);
        toast.error("Error checking invite code. Please try again.");
        return;
      }

      if (!classroom) {
        toast.error(`No classroom found with code: ${trimmedCode}`);
        return;
      }

      // Check if already enrolled
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('classroom_id', classroom.id)
        .eq('student_id', user.id)
        .maybeSingle();

      if (existingEnrollment) {
        toast.error("You're already enrolled in this classroom");
        setDialogOpen(false);
        return;
      }

      // Create enrollment
      const { error: enrollError } = await supabase
        .from('enrollments')
        .insert({
          classroom_id: classroom.id,
          student_id: user.id
        });

      if (enrollError) {
        console.error("Error enrolling:", enrollError);
        toast.error("Error joining classroom. Please contact your teacher.");
        return;
      }

      toast.success(`Successfully joined ${classroom.name}!`);
      setInviteCode("");
      setDialogOpen(false);
      await fetchData();
    } catch (error: any) {
      console.error("Unexpected error joining classroom:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-2xl font-bold">Student Dashboard</h1>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-6">
            {/* My Classes Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">My Classes</h2>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Join Class
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Join a Classroom</DialogTitle>
                      <DialogDescription>Enter the invite code provided by your teacher</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="code">Invite Code</Label>
                        <Input
                          id="code"
                          placeholder="ABC123"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                          maxLength={6}
                        />
                      </div>
                      <Button onClick={joinClassroom} className="w-full" disabled={joining}>
                        {joining ? "Joining..." : "Join Classroom"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : classrooms.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No classes yet</h3>
                    <p className="text-muted-foreground mb-4">Join a classroom to get started</p>
                    <Button onClick={() => setDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Join Class
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {classrooms.map((classroom) => (
                    <Card 
                      key={classroom.id} 
                      className="hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => navigate(`/student/classroom/${classroom.id}`)}
                    >
                      <CardHeader>
                        <CardTitle>{classroom.name}</CardTitle>
                        <CardDescription>{classroom.subject}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Assignments Section */}
            <div>
              <h2 className="text-2xl font-bold mb-4">My Assignments</h2>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : assignments.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No assignments yet</h3>
                    <p className="text-muted-foreground">Your assignments will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {assignments.map((assignment) => (
                    <Card 
                      key={assignment.id} 
                      className="hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => navigate(`/student/assignment/${assignment.id}`)}
                    >
                      <CardHeader>
                        <CardTitle>{assignment.title}</CardTitle>
                        <CardDescription>
                          {assignment.classrooms.name} • Due: {new Date(assignment.due_at).toLocaleDateString()}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            {scores ? (
              <>
                <FiveDChartCard scores={scores} title="My Growth Profile" />
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Your Strengths</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      You're showing great progress in {Object.entries(scores).sort((a: any, b: any) => b[1] - a[1])[0][0]} skills. Keep up the excellent work!
                    </p>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>My Growth Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Your growth profile will appear here once you complete assignments
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

export default StudentDashboard;