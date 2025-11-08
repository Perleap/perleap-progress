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
import { getUnreadNotifications, markAsRead, markAllAsRead, type Notification } from "@/lib/notificationService";

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
    fetchClassrooms();
  }, [user]);

  const fetchClassrooms = async () => {
    try {
      // Fetch teacher profile
      const { data: profileData, error: profileError} = await supabase
        .from('teacher_profiles')
        .select('full_name, avatar_url')
        .eq('user_id', user?.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
      } else if (profileData) {
        setProfile(profileData);
      }

      const { data, error } = await supabase
        .from('classrooms')
        .select('*')
        .eq('teacher_id', user?.id);

      if (error) throw error;
      setClassrooms(data || []);

      // Fetch notifications
      if (user?.id) {
        const notifs = await getUnreadNotifications(user.id);
        setNotifications(notifs);
        setUnreadCount(notifs.length);
      }
    } catch (error: any) {
      console.error("Error in fetchClassrooms:", error);
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
    if (!profile.full_name) return 'T';
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
            {!loading && profile.full_name ? `Welcome ${profile.full_name.split(' ')[0]} to your dashboard` : 'Teacher Dashboard'}
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
              onClick={() => navigate('/teacher/settings')}
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