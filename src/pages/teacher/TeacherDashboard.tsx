import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Plus, Users, BookOpen, LogOut } from "lucide-react";
import { toast } from "sonner";
import { CreateClassroomDialog } from "@/components/CreateClassroomDialog";

interface Classroom {
  id: string;
  name: string;
  subject: string;
  invite_code: string;
  _count?: { enrollments: number };
}

const TeacherDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchClassrooms();
  }, [user]);

  const fetchClassrooms = async () => {
    try {
      const { data, error } = await supabase
        .from('classrooms')
        .select('*')
        .eq('teacher_id', user?.id);

      if (error) throw error;
      setClassrooms(data || []);
    } catch (error: any) {
      toast.error("Error loading classrooms");
    } finally {
      setLoading(false);
    }
  };

  const handleClassroomCreated = (classroomId: string) => {
    fetchClassrooms();
    navigate(`/teacher/classroom/${classroomId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-3xl font-bold mb-2">My Classrooms</h2>
              <p className="text-muted-foreground">Manage your classes and track student progress</p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Classroom
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : classrooms.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No classrooms yet</h3>
                <p className="text-muted-foreground mb-4">Create your first classroom to get started</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Classroom
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classrooms.map((classroom) => (
                <Card key={classroom.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}>
                  <CardHeader>
                    <CardTitle>{classroom.name}</CardTitle>
                    <CardDescription>{classroom.subject}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>Invite code: {classroom.invite_code}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <CreateClassroomDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleClassroomCreated}
      />
    </div>
  );
};

export default TeacherDashboard;