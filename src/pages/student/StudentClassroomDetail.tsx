import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, BookOpen, Calendar, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Classroom {
  id: string;
  name: string;
  subject: string;
  course_title: string;
  course_duration: string;
  start_date: string;
  end_date: string;
  course_outline: string;
  resources: string;
  learning_outcomes: string[];
  key_challenges: string[];
}

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  due_at: string;
  status: string;
  type: string;
}

const StudentClassroomDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'recent' | 'latest' | 'due-date'>('due-date');
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    // Only fetch if we haven't fetched yet and we're not currently fetching
    if (!hasFetchedRef.current && !isFetchingRef.current) {
      fetchData();
    }
  }, [id, user]);

  const fetchData = async () => {
    if (isFetchingRef.current) return; // Prevent concurrent fetches

    isFetchingRef.current = true;

    try {
      // Check enrollment and fetch classroom
      const { data: enrollment, error: enrollError } = await supabase
        .from('enrollments')
        .select('classroom_id, classrooms(*)')
        .eq('student_id', user?.id)
        .eq('classroom_id', id)
        .maybeSingle();

      if (enrollError) throw enrollError;

      if (!enrollment) {
        toast.error(t('studentClassroom.errors.loading'));
        navigate('/student/dashboard');
        return;
      }

      setClassroom(enrollment.classrooms as any);

      // Fetch assignments
      const { data: assignmentsData, error: assignError } = await supabase
        .from('assignments')
        .select('*')
        .eq('classroom_id', id)
        .eq('status', 'published')
        .order('due_at', { ascending: true });

      if (assignError) throw assignError;
      setAssignments(assignmentsData || []);

      // Student analytics removed - only for teachers
    } catch (error) {
      toast.error(t('studentClassroom.errors.loading'));
      navigate('/student/dashboard');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      hasFetchedRef.current = true;
    }
  };

  const getSortedAssignments = () => {
    const sorted = [...assignments];
    switch (sortBy) {
      case 'recent':
        // Newest received first (by created_at)
        return sorted.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case 'oldest':
        // Oldest received first (by created_at)
        return sorted.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      case 'due-date':
        // Earliest due date first
        return sorted.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
      default:
        return sorted;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!classroom) return null;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title={classroom.name}
        subtitle={classroom.subject}
        userType="student"
        showBackButton
        onBackClick={() => navigate('/student/dashboard')}
      />

      <main className="container py-8">
        <div className="max-w-5xl mx-auto">
          <div>
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList>
                <TabsTrigger value="overview">{t('studentClassroom.about')}</TabsTrigger>
                <TabsTrigger value="assignments">{t('studentClassroom.assignments')}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
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
                            {classroom.start_date && (
                              <p>Start: {new Date(classroom.start_date).toLocaleDateString()}</p>
                            )}
                            {classroom.end_date && (
                              <p>End: {new Date(classroom.end_date).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {classroom.course_outline && (
                        <div>
                          <h3 className="font-semibold mb-1">Course Outline</h3>
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            {classroom.course_outline}
                          </p>
                        </div>
                      )}

                      {classroom.resources && (
                        <div>
                          <h3 className="font-semibold mb-1">Resources</h3>
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            {classroom.resources}
                          </p>
                        </div>
                      )}

                      {classroom.learning_outcomes && classroom.learning_outcomes.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-1">Learning Outcomes</h3>
                          <ul className="list-disc list-inside text-muted-foreground space-y-1">
                            {classroom.learning_outcomes.map((outcome, index) => (
                              <li key={index}>{outcome}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {classroom.key_challenges && classroom.key_challenges.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-1">Key Challenges</h3>
                          <ul className="list-disc list-inside text-muted-foreground space-y-1">
                            {classroom.key_challenges.map((challenge, index) => (
                              <li key={index}>{challenge}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="assignments" className="space-y-4">
                {assignments.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        {t('studentClassroom.noAssignments')}
                      </h3>
                      <p className="text-muted-foreground">Check back later for new assignments</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        {assignments.length}{' '}
                        {assignments.length === 1 ? 'Assignment' : 'Assignments'}
                      </h3>
                      <Select
                        value={sortBy}
                        onValueChange={(value) => setSortBy(value as typeof sortBy)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder={t('studentDashboard.sortBy')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="due-date">
                            {t('studentDashboard.sortOptions.dueDate')}
                          </SelectItem>
                          <SelectItem value="recent">
                            {t('studentDashboard.sortOptions.recent')}
                          </SelectItem>
                          <SelectItem value="oldest">
                            {t('studentDashboard.sortOptions.oldest')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {getSortedAssignments().map((assignment) => (
                      <Card
                        key={assignment.id}
                        className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => navigate(`/student/assignment/${assignment.id}`)}
                      >
                        <CardHeader>
                          <CardTitle>{assignment.title}</CardTitle>
                          <CardDescription>
                            {t('assignmentDetail.type')}: {assignment.type.replace('_', ' ')} •
                            {assignment.due_at &&
                              ` ${t('common.due')}: ${new Date(assignment.due_at).toLocaleString()}`}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {assignment.instructions}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentClassroomDetail;
