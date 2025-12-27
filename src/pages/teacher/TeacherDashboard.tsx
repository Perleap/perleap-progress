import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { CreateClassroomDialog } from '@/components/CreateClassroomDialog';
import { TeacherCalendar } from '@/components/TeacherCalendar';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layouts';
import { useStaggerAnimation } from '@/hooks/useGsapAnimations';
import { SkeletonCardGrid } from '@/components/ui/GsapSkeleton';
import { EmptyState } from '@/components/ui/empty-state';

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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url?: string }>({
    full_name: '',
    avatar_url: '',
  });
  const cardsRef = useStaggerAnimation(':scope > div', 0.08);

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
      <DashboardLayout breadcrumbs={[{ label: t('nav.dashboard') }]}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">{t('common.loading')}</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: t('nav.dashboard') }]}>
      {/* Enhanced Page Header with Gradient Background */}
      <div className="relative -mx-6 md:-mx-8 lg:-mx-10 -mt-6 md:-mt-8 lg:-mt-10 px-6 md:px-8 lg:px-10 pt-6 md:pt-8 lg:pt-10 pb-6 md:pb-8 mb-6 md:mb-8 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent dark:from-primary/10 dark:via-accent/10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(108,68,188,0.1),transparent_50%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(108,68,188,0.2),transparent_50%)]" />
        
        <div className="relative flex flex-col gap-3">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg flex-shrink-0">
              <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text truncate">
                {t('teacherDashboard.title')}
              </h1>
              <p className="text-muted-foreground mt-0.5 md:mt-1 text-sm md:text-base truncate">{t('teacherDashboard.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_420px] gap-6 md:gap-8 xl:gap-10">
        <div className="space-y-6 md:space-y-8">
          {/* Section Header with Enhanced Button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight">{t('teacherDashboard.myClassrooms')}</h2>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Manage and track your classes</p>
            </div>
            <Button
              onClick={() => setDialogOpen(true)}
              size="lg"
              className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300 group w-full sm:w-auto flex-shrink-0"
            >
              <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" />
              <span className="whitespace-nowrap">{t('teacherDashboard.createClassroom')}</span>
            </Button>
          </div>

          {loading ? (
            <SkeletonCardGrid count={4} />
          ) : classrooms.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t('teacherDashboard.empty.title')}
              description={t('teacherDashboard.empty.description')}
              action={{
                label: t('teacherDashboard.createClassroom'),
                onClick: () => setDialogOpen(true),
              }}
            />
          ) : (
            <div ref={cardsRef} className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
              {classrooms.map((classroom) => (
                <Card
                  key={classroom.id}
                  className="group relative overflow-hidden cursor-pointer border-2 hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 md:hover:-translate-y-1 bg-gradient-to-br from-card/80 to-card backdrop-blur-sm active:scale-95 md:active:scale-100"
                  onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}
                >
                  {/* Decorative gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <CardContent className="p-4 md:p-6 relative">
                    <div className="flex items-start justify-between gap-3 md:gap-4 mb-3 md:mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base md:text-lg mb-2 md:mb-3 truncate group-hover:text-primary transition-colors">
                          {classroom.name}
                        </h3>
                        <Badge 
                          variant="secondary" 
                          className="text-xs font-semibold px-2.5 md:px-3 py-0.5 md:py-1 bg-primary/10 text-primary border-primary/20 group-hover:bg-primary/20 transition-colors"
                        >
                          {classroom.subject}
                        </Badge>
                      </div>
                      <div className="h-10 w-10 md:h-12 md:w-12 rounded-lg md:rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 flex-shrink-0">
                        <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm text-muted-foreground pt-3 md:pt-4 border-t border-border/50 flex-wrap">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <div className="h-7 w-7 md:h-8 md:w-8 rounded-md md:rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Users className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        </div>
                        <span className="font-medium whitespace-nowrap">{classroom._count?.enrollments || 0} {t('common.students')}</span>
                      </div>
                      <span className="text-border hidden sm:inline">•</span>
                      <div className="flex items-center gap-2 font-mono text-xs bg-muted/50 px-2 md:px-3 py-1 rounded-full">
                        {classroom.invite_code}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Calendar Sidebar */}
        <aside className="space-y-6 md:space-y-8">
          {user && (
            <div className="lg:sticky lg:top-6">
              <TeacherCalendar
                teacherId={user.id}
                classrooms={calendarClassrooms}
                loading={loading}
              />
            </div>
          )}
        </aside>
      </div>

      <CreateClassroomDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleClassroomCreated}
      />
    </DashboardLayout>
  );
};

export default TeacherDashboard;
