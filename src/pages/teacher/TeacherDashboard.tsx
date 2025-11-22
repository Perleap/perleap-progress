import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { BreathingBackground } from '@/components/ui/BreathingBackground';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Moon, Sun, Globe, User } from "lucide-react";
import { useTheme } from "next-themes";
import { DashboardHeader } from '@/components/DashboardHeader';

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
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
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
    // ProtectedRoute handles auth, just fetch data when user is available
    // Wait for auth to finish loading before checking user
    if (authLoading) return;

    if (!user?.id) return;

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
      // Fetch teacher profile - use maybeSingle() to handle cases where profile doesn't exist yet
      const { data: profileData, error: profileError } = await supabase
        .from('teacher_profiles')
        .select('full_name, avatar_url')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (!profileError && profileData) {
        setProfile(profileData);
      } else if (profileError) {
        console.error('Error fetching teacher profile:', profileError);
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

  // Deterministic gradient based on classroom ID or name
  const getGradient = (id: string) => {
    const gradients = [
      "from-pink-50 to-rose-100 dark:from-pink-950/30 dark:to-rose-900/30",
      "from-orange-50 to-amber-100 dark:from-orange-950/30 dark:to-amber-900/30",
      "from-blue-50 to-indigo-100 dark:from-blue-950/30 dark:to-indigo-900/30",
      "from-emerald-50 to-teal-100 dark:from-emerald-950/30 dark:to-teal-900/30",
      "from-violet-50 to-purple-100 dark:from-violet-950/30 dark:to-purple-900/30",
    ];
    const index = id.charCodeAt(0) % gradients.length;
    return gradients[index];
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
    <BreathingBackground className="min-h-screen pb-12">
      <DashboardHeader
        title={t('teacherDashboard.title')}
        userType="teacher"
      />

      <main className="container py-8 px-4 relative z-10 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="mb-10 relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-100 via-purple-50 to-blue-50 dark:from-violet-950/40 dark:via-purple-900/20 dark:to-blue-900/20 p-8 md:p-10 shadow-sm border border-white/20">
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 mb-3">
              {t('teacherDashboard.welcome', { name: profile.full_name?.split(' ')[0] || 'Teacher' })}
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-lg max-w-2xl">
              {t('teacherDashboard.subtitle')}
            </p>
          </div>
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/30 dark:bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="absolute left-0 bottom-0 w-48 h-48 bg-blue-200/30 dark:bg-blue-500/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {t('teacherDashboard.myClassrooms')}
                </h2>
              </div>
              <Button
                onClick={() => setDialogOpen(true)}
                className="w-full sm:w-auto rounded-full shadow-md hover:shadow-lg transition-all bg-primary hover:bg-primary/90"
              >
                <Plus className="me-2 h-4 w-4" />
                {t('teacherDashboard.createClassroom')}
              </Button>
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-48 rounded-3xl bg-slate-100 dark:bg-slate-800/50 animate-pulse" />
                ))}
              </div>
            ) : classrooms.length === 0 ? (
              <Card className="bg-white/60 backdrop-blur-sm border-dashed border-2 border-slate-300 dark:border-slate-700 rounded-3xl overflow-hidden">
                <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6">
                    <BookOpen className="h-10 w-10 text-blue-500 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                    {t('teacherDashboard.empty.title')}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
                    {t('teacherDashboard.empty.description')}
                  </p>
                  <Button onClick={() => setDialogOpen(true)} size="lg" className="rounded-full px-8">
                    <Plus className="me-2 h-5 w-5" />
                    {t('teacherDashboard.createClassroom')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-6">
                {classrooms.map((classroom) => (
                  <Card
                    key={classroom.id}
                    className="group border-0 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer bg-white dark:bg-slate-900 rounded-3xl overflow-hidden ring-1 ring-slate-200/50 dark:ring-slate-800"
                    onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}
                  >
                    <div className={`h-16 bg-gradient-to-br ${getGradient(classroom.id)} p-4 relative overflow-hidden`}>
                      <div className="absolute right-4 top-2 opacity-20 group-hover:opacity-40 transition-opacity transform group-hover:scale-110 duration-500">
                        <BookOpen className="h-12 w-12" />
                      </div>
                      <Badge className="bg-white/90 dark:bg-black/50 text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-black/70 backdrop-blur-sm border-0 shadow-sm">
                        {classroom.subject}
                      </Badge>
                    </div>
                    <CardContent className="p-6">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 group-hover:text-primary transition-colors">
                        {classroom.name}
                      </h3>

                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full">
                          <Users className="h-3.5 w-3.5" />
                          <span className="font-medium">
                            {t('teacherDashboard.inviteCode')}: <span className="text-slate-700 dark:text-slate-300 font-mono">{classroom.invite_code}</span>
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Calendar Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {user && (
              <div className="sticky top-24">
                <TeacherCalendar
                  teacherId={user.id}
                  classrooms={calendarClassrooms}
                  loading={loading}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <CreateClassroomDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleClassroomCreated}
      />
    </BreathingBackground>
  );
};

export default TeacherDashboard;
