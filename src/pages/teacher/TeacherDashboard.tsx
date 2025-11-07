import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Plus, Users, BookOpen, LogOut, Bell } from "lucide-react";
import { toast } from "sonner";
import { CreateClassroomDialog } from "@/components/CreateClassroomDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [notificationCount] = useState(5); // Mock notification count
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; avatar_url: string | null }>({
    first_name: "",
    last_name: "",
    avatar_url: null,
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchClassrooms();
  }, [user]);

  const fetchClassrooms = async () => {
    try {
      // Fetch teacher profile for avatar
      const { data: profileData } = await supabase
        .from('teacher_profiles')
        .select('first_name, last_name, avatar_url')
        .eq('user_id', user?.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

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

  const getInitials = () => {
    return `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase() || 'T';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 md:h-16 items-center justify-between px-4">
          <h1 className="text-lg md:text-2xl font-bold">Teacher Dashboard</h1>
          <div className="flex items-center gap-2">
            {/* Notifications Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  <Bell className="h-4 w-4" />
                  {notificationCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {notificationCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-2">
                  <h3 className="font-semibold mb-2">Notifications</h3>
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-accent/50 text-sm">
                      <p className="font-medium">New submission</p>
                      <p className="text-xs text-muted-foreground">John Doe submitted Math Assignment</p>
                    </div>
                    <div className="p-3 rounded-lg bg-accent/50 text-sm">
                      <p className="font-medium">Student question</p>
                      <p className="text-xs text-muted-foreground">Sarah asked about Chapter 5</p>
                    </div>
                    <div className="p-3 rounded-lg bg-accent/50 text-sm">
                      <p className="font-medium">Grading reminder</p>
                      <p className="text-xs text-muted-foreground">3 assignments need grading</p>
                    </div>
                    <div className="p-3 rounded-lg bg-accent/50 text-sm">
                      <p className="font-medium">New student enrolled</p>
                      <p className="text-xs text-muted-foreground">Michael joined Biology 101</p>
                    </div>
                    <div className="p-3 rounded-lg bg-accent/50 text-sm">
                      <p className="font-medium">Assignment deadline</p>
                      <p className="text-xs text-muted-foreground">Chemistry quiz closes tomorrow</p>
                    </div>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile Avatar */}
            <Button
              variant="ghost"
              size="sm"
              className="relative h-10 w-10 rounded-full p-0"
              onClick={() => navigate('/teacher/settings')}
            >
              <Avatar className="h-10 w-10 cursor-pointer">
                {profile.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt="Profile" />
                ) : null}
                <AvatarFallback>{getInitials()}</AvatarFallback>
              </Avatar>
            </Button>

            {/* Sign Out Button */}
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-0 md:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-4 md:py-8 px-4">
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 md:mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">My Classrooms</h2>
              <p className="text-sm md:text-base text-muted-foreground">Manage your classes and track student progress</p>
            </div>
            <Button onClick={() => setDialogOpen(true)} size="sm" className="w-full sm:w-auto">
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {classrooms.map((classroom) => (
                <Card key={classroom.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}>
                  <CardHeader>
                    <CardTitle className="text-base md:text-lg">{classroom.name}</CardTitle>
                    <CardDescription className="text-sm">{classroom.subject}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                      <Users className="h-3 w-3 md:h-4 md:w-4" />
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