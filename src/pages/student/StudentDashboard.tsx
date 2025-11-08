import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { LogOut, Plus, BookOpen, Bell } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createNotification, getUnreadNotifications, markAsRead, markAllAsRead, type Notification } from "@/lib/notificationService";

interface Assignment {
  id: string;
  title: string;
  due_at: string;
  classrooms: {
    name: string;
    teacher_id: string;
    teacher_profiles?: {
      full_name: string;
      avatar_url?: string;
    };
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url?: string }>({
    full_name: "",
    avatar_url: "",
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
      // Fetch student profile
      const { data: profileData, error: profileError } = await supabase
        .from('student_profiles')
        .select('full_name, avatar_url')
        .eq('user_id', user?.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
      } else if (profileData) {
        setProfile(profileData);
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

        // Fetch assignments with teacher info
        const { data: assignmentsData } = await supabase
          .from('assignments')
          .select('*, classrooms(name, teacher_id)')
          .in('classroom_id', classroomIds)
          .eq('status', 'published')
          .order('due_at', { ascending: true });

        // Fetch teacher profiles
        if (assignmentsData && assignmentsData.length > 0) {
          const teacherIds = [...new Set(assignmentsData.map(a => a.classrooms.teacher_id))];
          const { data: teacherProfiles } = await supabase
            .from('teacher_profiles')
            .select('user_id, full_name, avatar_url')
            .in('user_id', teacherIds);

          // Combine data
          const assignmentsWithTeachers = assignmentsData.map(assignment => ({
            ...assignment,
            classrooms: {
              ...assignment.classrooms,
              teacher_profiles: teacherProfiles?.find(t => t.user_id === assignment.classrooms.teacher_id)
            }
          }));

          setAssignments(assignmentsWithTeachers);
        } else {
          setAssignments([]);
        }
      } else {
        setClassrooms([]);
        setAssignments([]);
      }

      // Fetch notifications
      if (user?.id) {
        const notifs = await getUnreadNotifications(user.id);
        setNotifications(notifs);
        setUnreadCount(notifs.length);
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
      
      // Check if classroom exists - use a simpler query that bypasses RLS
      const { data: classroom, error: classroomError } = await supabase
        .from('classrooms')
        .select('id, name, invite_code')
        .eq('invite_code', trimmedCode)
        .maybeSingle();

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

      // Get student name for notification
      const { data: studentProfile } = await supabase
        .from('student_profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const studentName = studentProfile?.full_name || user.email || 'A student';

      // Notify the teacher about new enrollment
      try {
        const { data: classroomData } = await supabase
          .from('classrooms')
          .select('teacher_id')
          .eq('id', classroom.id)
          .single();

        if (classroomData?.teacher_id) {
          await createNotification(
            classroomData.teacher_id,
            'student_enrolled',
            'New Student Enrolled',
            `${studentName} joined ${classroom.name}`,
            `/teacher/classroom/${classroom.id}`,
            {
              classroom_id: classroom.id,
              student_id: user.id,
              student_name: studentName,
              classroom_name: classroom.name,
            }
          );
        }

        // Notify the student about successful enrollment
        await createNotification(
          user.id,
          'enrolled_in_classroom',
          'Successfully Enrolled',
          `You've joined ${classroom.name}`,
          `/student/classroom/${classroom.id}`,
          {
            classroom_id: classroom.id,
            classroom_name: classroom.name,
          }
        );
      } catch (notifError) {
        // Don't fail enrollment if notifications fail
        console.error('Error creating enrollment notifications:', notifError);
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

  const getInitials = () => {
    if (!profile.full_name) return 'S';
    const names = profile.full_name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return names[0][0].toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 md:h-16 items-center justify-between px-4">
          <h1 className="text-lg md:text-2xl font-bold">
            {!loading && profile.full_name ? `Welcome ${profile.full_name.split(' ')[0]} to your dashboard` : 'Student Dashboard'}
          </h1>
          <div className="flex items-center gap-2">
            {/* Notifications Dropdown */}
            <DropdownMenu open={notificationDropdownOpen} onOpenChange={setNotificationDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="relative h-8 w-8 rounded-full">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                <div className="p-2">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={async () => {
                          if (user?.id) {
                            await markAllAsRead(user.id);
                            setNotifications([]);
                            setUnreadCount(0);
                            toast.success("All notifications marked as read");
                          }
                        }}
                      >
                        Mark all read
                      </Button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      No new notifications
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="p-3 rounded-lg bg-accent/50 text-sm hover:bg-accent cursor-pointer transition-colors"
                          onClick={async () => {
                            await markAsRead(notification.id);
                            setNotifications(prev => prev.filter(n => n.id !== notification.id));
                            setUnreadCount(prev => Math.max(0, prev - 1));
                            setNotificationDropdownOpen(false);
                            if (notification.link) {
                              navigate(notification.link);
                            }
                          }}
                        >
                          <p className="font-medium">{notification.title}</p>
                          <p className="text-xs text-muted-foreground">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(notification.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sign Out Button */}
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>

            {/* Profile Avatar */}
            <Button
              variant="ghost"
              size="sm"
              className="relative h-12 w-12 rounded-full p-0"
              onClick={() => navigate('/student/settings')}
            >
              <Avatar className="h-12 w-12 cursor-pointer">
                {profile.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                )}
                <AvatarFallback>{getInitials()}</AvatarFallback>
              </Avatar>
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-4 md:py-8 px-4">
        <div className="space-y-6">
            {/* My Classes Section */}
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h2 className="text-xl md:text-2xl font-bold">My Classes</h2>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full sm:w-auto">
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
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classrooms.map((classroom) => (
                    <Card 
                      key={classroom.id} 
                      className="hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => navigate(`/student/classroom/${classroom.id}`)}
                    >
                      <CardHeader>
                        <CardTitle className="text-base md:text-lg">{classroom.name}</CardTitle>
                        <CardDescription className="text-sm">{classroom.subject}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Assignments Section */}
            <div>
              <h2 className="text-xl md:text-2xl font-bold mb-4">My Assignments</h2>
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
                <div className="space-y-3">
                  {assignments.map((assignment) => {
                    const teacherInitials = assignment.classrooms.teacher_profiles?.full_name
                      ?.split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase() || 'T';
                    
                    return (
                      <Card 
                        key={assignment.id} 
                        className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => navigate(`/student/assignment/${assignment.id}`)}
                      >
                        <CardHeader className="p-4 pb-3">
                          <CardTitle className="text-base mb-1">{assignment.title}</CardTitle>
                          <CardDescription className="text-sm mb-2">
                            {assignment.classrooms.name} • Due: {new Date(assignment.due_at).toLocaleDateString()}
                          </CardDescription>
                          <div className="flex items-center gap-2 mt-2">
                            <Avatar className="h-6 w-6">
                              {assignment.classrooms.teacher_profiles?.avatar_url && (
                                <AvatarImage 
                                  src={assignment.classrooms.teacher_profiles.avatar_url} 
                                  alt={assignment.classrooms.teacher_profiles.full_name || 'Teacher'} 
                                />
                              )}
                              <AvatarFallback className="text-xs">{teacherInitials}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                              {assignment.classrooms.teacher_profiles?.full_name || 'Teacher'}
                            </span>
                          </div>
                        </CardHeader>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;