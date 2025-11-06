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

const StudentDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState({
    cognitive: 2.5,
    emotional: 2.5,
    social: 2.5,
    creative: 2.5,
    behavioral: 2.5
  });

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
        .single();

      if (snapshot?.scores) {
        setScores(snapshot.scores as any);
      }

      // Fetch assignments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('classroom_id')
        .eq('student_id', user?.id);

      if (enrollments && enrollments.length > 0) {
        const classroomIds = enrollments.map(e => e.classroom_id);
        const { data: assignmentsData } = await supabase
          .from('assignments')
          .select('*, classrooms(name)')
          .in('classroom_id', classroomIds)
          .eq('status', 'published')
          .order('due_at', { ascending: true });

        setAssignments(assignmentsData || []);
      }
    } catch (error: any) {
      toast.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const joinClassroom = async () => {
    if (!user || !inviteCode) return;

    try {
      const { data: classroom } = await supabase
        .from('classrooms')
        .select('id')
        .eq('invite_code', inviteCode.toUpperCase())
        .single();

      if (!classroom) {
        toast.error("Invalid invite code");
        return;
      }

      const { error } = await supabase
        .from('enrollments')
        .insert({
          classroom_id: classroom.id,
          student_id: user.id
        });

      if (error) throw error;

      toast.success("Joined classroom!");
      setInviteCode("");
      fetchData();
    } catch (error: any) {
      toast.error("Error joining classroom");
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
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-3xl font-bold mb-2">My Assignments</h2>
                <p className="text-muted-foreground">Complete your tasks and track progress</p>
              </div>
              <Dialog>
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
                      />
                    </div>
                    <Button onClick={joinClassroom} className="w-full">Join Classroom</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : assignments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No assignments yet</h3>
                  <p className="text-muted-foreground">Join a classroom to see assignments</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {assignments.map((assignment) => (
                  <Card key={assignment.id} className="hover:shadow-lg transition-shadow cursor-pointer">
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

          <div>
            <FiveDChartCard scores={scores} title="My Growth Profile" />
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Your Strengths</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  You're showing great progress in {Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]} skills. Keep up the excellent work!
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;