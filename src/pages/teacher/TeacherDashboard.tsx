import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, BookOpen, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { CreateClassroomDialog } from '@/components/CreateClassroomDialog';
import { NotificationDropdown } from '@/components/common';
import { TeacherCalendar } from '@/components/TeacherCalendar';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Classroom {
  id: string;
  name: string;
  subject: string;
  invite_code: string;
  start_date?: string | null;
  end_date?: string | null;
  _count?: { enrollments: number };
}

interface CalendarClassroom {
  id: string;
  name: string;
  subject: string;
  start_date: string | null;
  end_date: string | null;
}

const TeacherDashboard = () => {
  const { t } = useTranslation();
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url?: string }>({
    full_name: '',
    avatar_url: '',
  });

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Wait for auth to finish loading before checking user
    if (authLoading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    // Reset fetch flag if user ID actually changed
    if (lastUserIdRef.current !== user.id) {
      hasFetchedRef.current = false;
      lastUserIdRef.current = user.id;
    }

    // Only fetch if we haven't fetched yet and not currently fetching
    if (!hasFetchedRef.current && !isFetchingRef.current) {
      fetchClassrooms();
    }
  }, [user?.id, authLoading]); // Use user?.id instead of user to avoid refetch on user object reference change

  const fetchClassrooms = async () => {
    isFetchingRef.current = true;
    try {
      // Fetch teacher profile
      const { data: profileData, error: profileError } = await supabase
        .from('teacher_profiles')
        .select('full_name, avatar_url')
        .eq('user_id', user?.id)
        .single();

      if (!profileError && profileData) {
        setProfile(profileData);
      }

      const { data, error } = await supabase
        .from('classrooms')
        .select('id, name, subject, invite_code, start_date, end_date')
        .eq('teacher_id', user?.id);

      if (error) throw error;
      setClassrooms(data || []);
    } catch (error) {
      toast.error(t('teacherDashboard.errors.loadingClassrooms'));
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      hasFetchedRef.current = true;
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

  // Transform data for calendar component
  const calendarClassrooms: CalendarClassroom[] = classrooms.map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    start_date: c.start_date || null,
    end_date: c.end_date || null,
  }));

  // Show loading screen while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 md:h-16 items-center justify-between px-4">
          <h1 className="text-lg md:text-2xl font-bold">
            {!loading && profile.full_name
              ? t('teacherDashboard.welcome', { name: profile.full_name.split(' ')[0] })
              : t('teacherDashboard.title')}
          </h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            <NotificationDropdown translationKeyPrefix="teacherDashboard" />
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
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
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-6 md:mb-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 md:mb-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">
                    {t('teacherDashboard.myClassrooms')}
                  </h2>
                  <p className="text-sm md:text-base text-muted-foreground">
                    {t('teacherDashboard.subtitle')}
                  </p>
                </div>
                <Button onClick={() => setDialogOpen(true)} size="sm" className="w-full sm:w-auto">
                  <Plus className="me-2 h-4 w-4" />
                  {t('teacherDashboard.createClassroom')}
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
              ) : classrooms.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      {t('teacherDashboard.empty.title')}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {t('teacherDashboard.empty.description')}
                    </p>
                    <Button onClick={() => setDialogOpen(true)}>
                      <Plus className="me-2 h-4 w-4" />
                      {t('teacherDashboard.createClassroom')}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {classrooms.map((classroom) => (
                    <Card
                      key={classroom.id}
                      className="hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}
                    >
                      <CardHeader>
                        <CardTitle className="text-base md:text-lg">{classroom.name}</CardTitle>
                        <CardDescription className="text-sm">{classroom.subject}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                          <Users className="h-3 w-3 md:h-4 md:w-4" />
                          <span>
                            {t('teacherDashboard.inviteCode')} {classroom.invite_code}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Calendar Sidebar */}
          <div className="lg:col-span-1">
            {user && (
              <TeacherCalendar
                teacherId={user.id}
                classrooms={calendarClassrooms}
                loading={loading}
              />
            )}
          </div>
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
