import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Users,
  BookOpen,
  Calendar,
  Plus,
  Edit,
  BarChart3,
  Trash2,
  FileText,
  Link as LinkIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { EditClassroomDialog } from '@/components/EditClassroomDialog';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { EditAssignmentDialog } from '@/components/EditAssignmentDialog';
import { ClassroomAnalytics } from '@/components/ClassroomAnalytics';
import { SubmissionsTab } from '@/components/SubmissionsTab';
import { RegenerateScoresButton } from '@/components/RegenerateScoresButton';

interface CourseMaterial {
  url: string;
  name: string;
}

interface Classroom {
  id: string;
  name: string;
  subject: string;
  invite_code: string;
  course_title: string;
  course_duration: string;
  start_date: string;
  end_date: string;
  course_outline: string;
  resources: string;
  learning_outcomes: string[] | null;
  key_challenges: string[] | null;
}

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  type: string;
  status: string;
  due_at: string;
  materials?: string;
  assigned_student_id: string | null;
  student_profiles?: {
    full_name: string;
  } | null;
}

interface EnrolledStudent {
  id: string;
  created_at: string;
  student_id: string;
  student_profiles: {
    full_name: string;
    avatar_url?: string;
    user_id: string;
  } | null;
}

const ClassroomDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [editAssignmentDialogOpen, setEditAssignmentDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastIdRef = useRef(id);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    // Reset refs if classroom ID changes
    if (lastIdRef.current !== id) {
      hasFetchedRef.current = false;
      isFetchingRef.current = false;
      lastIdRef.current = id;
    }

    // Only fetch if we haven't fetched yet and not currently fetching
    if (!hasFetchedRef.current && !isFetchingRef.current) {
      fetchClassroom();
    }
  }, [id, user]);

  const fetchClassroom = async () => {
    isFetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('classrooms')
        .select('*')
        .eq('id', id)
        .eq('teacher_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error(t('classroomDetail.errors.loading'));
        navigate('/teacher/dashboard');
        return;
      }
      setClassroom(data);
      await fetchAssignments();
      await fetchStudents();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t('classroomDetail.errors.loading');
      console.error('Error loading classroom:', errorMessage);
      toast.error(t('classroomDetail.errors.loading'));
      navigate('/teacher/dashboard');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      hasFetchedRef.current = true;
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data: assignmentsData, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('classroom_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch student profiles for assigned students
      const assignedStudentIds =
        assignmentsData?.filter((a) => a.assigned_student_id).map((a) => a.assigned_student_id) ||
        [];

      let studentProfilesMap: Record<string, { full_name: string }> = {};

      if (assignedStudentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('student_profiles')
          .select('user_id, full_name')
          .in('user_id', assignedStudentIds);

        if (profiles) {
          studentProfilesMap = profiles.reduce(
            (acc, profile) => {
              acc[profile.user_id] = { full_name: profile.full_name };
              return acc;
            },
            {} as Record<string, { full_name: string }>
          );
        }
      }

      // Combine data
      const assignmentsWithProfiles =
        assignmentsData?.map((assignment) => ({
          ...assignment,
          student_profiles: assignment.assigned_student_id
            ? studentProfilesMap[assignment.assigned_student_id] || null
            : null,
        })) || [];

      setAssignments(assignmentsWithProfiles);
    } catch (error) {
      // Silent fail - assignments will be empty
      console.error('Error fetching assignments:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select('id, created_at, student_id')
        .eq('classroom_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!enrollments || enrollments.length === 0) {
        setStudents([]);
        return;
      }

      // Fetch student profiles separately
      const studentIds = enrollments.map((e) => e.student_id);
      const { data: profiles, error: profileError } = await supabase
        .from('student_profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', studentIds);

      // Continue even if some profiles fail to load

      // Combine the data
      const studentsWithProfiles = enrollments.map((enrollment) => ({
        id: enrollment.id,
        created_at: enrollment.created_at,
        student_id: enrollment.student_id,
        student_profiles: profiles?.find((p) => p.user_id === enrollment.student_id) || null,
      }));

      setStudents(studentsWithProfiles);
    } catch (error) {
      // Silent fail - students will be empty
      console.error('Error fetching students:', error);
    }
  };

  const deleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;

    try {
      const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);

      if (error) throw error;
      toast.success(t('classroomDetail.success.assignmentDeleted'));
      fetchAssignments();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error(t('classroomDetail.errors.deleting'));
    }
  };

  const deleteClassroom = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('classrooms')
        .delete()
        .eq('id', id)
        .eq('teacher_id', user?.id);

      if (error) throw error;

      toast.success(t('classroomDetail.success.deleted'));
      navigate('/teacher/dashboard');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t('classroomDetail.errors.deleting');
      console.error('Error deleting classroom:', errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
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
        userType="teacher"
        showBackButton
        onBackClick={() => navigate('/teacher/dashboard')}
      />

      <main className="container py-4 md:py-8 px-4">
        <Tabs defaultValue="overview" className="space-y-4 md:space-y-6">
          <div className="overflow-x-auto pb-2 -mx-4 px-4">
            <TabsList className="inline-flex w-full min-w-max md:w-auto">
              <TabsTrigger value="overview" className="text-xs md:text-sm">
                {t('classroomDetail.settings')}
              </TabsTrigger>
              <TabsTrigger value="assignments" className="text-xs md:text-sm">
                {t('classroomDetail.assignments')}
              </TabsTrigger>
              <TabsTrigger value="students" className="text-xs md:text-sm">
                {t('classroomDetail.students')}
              </TabsTrigger>
              <TabsTrigger value="submissions" className="text-xs md:text-sm">
                {t('classroomDetail.submissionsTab')}
              </TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs md:text-sm">
                {t('classroomDetail.analytics')}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-xl md:text-2xl font-bold">
                {t('classroomDetail.overview.title')}
              </h2>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  onClick={() => setEditDialogOpen(true)}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <Edit className="me-2 h-4 w-4" />
                  {t('classroomDetail.edit')}
                </Button>
                <Button
                  onClick={() => setDeleteDialogOpen(true)}
                  size="sm"
                  variant="destructive"
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="me-2 h-4 w-4" />
                  {t('classroomDetail.deleteButton')}
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('classroomDetail.inviteCode')}</CardTitle>
                <CardDescription>{t('classroomDetail.shareCode')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="text-2xl font-mono font-bold px-4 py-2 bg-muted rounded-lg">
                    {classroom.invite_code}
                  </code>
                </div>
              </CardContent>
            </Card>

            {classroom.course_title && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    {t('classroomDetail.overview.courseInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-1">
                      {t('classroomDetail.overview.courseTitle')}
                    </h3>
                    <p className="text-muted-foreground">{classroom.course_title}</p>
                  </div>

                  {classroom.course_duration && (
                    <div>
                      <h3 className="font-semibold mb-1">
                        {t('classroomDetail.overview.duration')}
                      </h3>
                      <p className="text-muted-foreground">{classroom.course_duration}</p>
                    </div>
                  )}

                  {(classroom.start_date || classroom.end_date) && (
                    <div>
                      <h3 className="font-semibold mb-1 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {t('classroomDetail.overview.courseDates')}
                      </h3>
                      <div className="text-muted-foreground">
                        {classroom.start_date && (
                          <p>
                            {t('common.start')}:{' '}
                            {new Date(classroom.start_date).toLocaleDateString()}
                          </p>
                        )}
                        {classroom.end_date && (
                          <p>
                            {t('common.end')}: {new Date(classroom.end_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {classroom.course_outline && (
                    <div>
                      <h3 className="font-semibold mb-1">
                        {t('classroomDetail.overview.courseOutline')}
                      </h3>
                      <p className="text-muted-foreground whitespace-pre-wrap">
                        {classroom.course_outline}
                      </p>
                    </div>
                  )}

                  {classroom.resources && (
                    <div>
                      <h3 className="font-semibold mb-1">
                        {t('classroomDetail.overview.resources')}
                      </h3>
                      <p className="text-muted-foreground whitespace-pre-wrap">
                        {classroom.resources}
                      </p>
                    </div>
                  )}

                  {classroom.learning_outcomes && classroom.learning_outcomes.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-1">
                        {t('classroomDetail.overview.learningOutcomes')}
                      </h3>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        {classroom.learning_outcomes.map((outcome: string, index: number) => (
                          <li key={index}>{outcome}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {classroom.key_challenges && classroom.key_challenges.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-1">
                        {t('classroomDetail.overview.keyChallenges')}
                      </h3>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        {classroom.key_challenges.map((challenge: string, index: number) => (
                          <li key={index}>{challenge}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-xl md:text-2xl font-bold">
                  {t('classroomDetail.assignments')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('classroomDetail.assignmentsSubtitle')}
                </p>
              </div>
              <Button
                onClick={() => setAssignmentDialogOpen(true)}
                size="sm"
                className="w-full sm:w-auto"
              >
                <Plus className="me-2 h-4 w-4" />
                {t('classroomDetail.createAssignment')}
              </Button>
            </div>

            {assignments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {t('classroomDetail.noAssignments')}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first assignment to get started
                  </p>
                  <Button onClick={() => setAssignmentDialogOpen(true)}>
                    <Plus className="me-2 h-4 w-4" />
                    {t('classroomDetail.createAssignment')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {assignments.map((assignment) => (
                  <Card key={assignment.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle>{assignment.title}</CardTitle>
                            {assignment.assigned_student_id && (
                              <Badge
                                variant="outline"
                                className="bg-purple-50 text-purple-700 border-purple-200"
                              >
                                For: {assignment.student_profiles?.full_name || 'Student'}
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="mt-2">
                            Type: {assignment.type.replace('_', ' ')} •
                            {assignment.due_at &&
                              ` Due: ${new Date(assignment.due_at).toLocaleString()}`}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={assignment.status === 'published' ? 'default' : 'secondary'}
                          >
                            {assignment.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAssignment(assignment);
                              setEditAssignmentDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteAssignment(assignment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {assignment.instructions}
                      </p>

                      {/* Course Materials */}
                      {assignment.materials &&
                        (() => {
                          try {
                            const materials: CourseMaterial[] = JSON.parse(assignment.materials);
                            if (Array.isArray(materials) && materials.length > 0) {
                              return (
                                <div className="pt-2 border-t">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                                    Course Materials ({materials.length})
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {materials.map((material, index) => (
                                      <Button
                                        key={index}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(material.url, '_blank')}
                                        className="gap-2"
                                      >
                                        {material.type === 'pdf' ? (
                                          <>
                                            <FileText className="h-3 w-3" />
                                            <span className="text-xs">{material.name}</span>
                                          </>
                                        ) : (
                                          <>
                                            <LinkIcon className="h-3 w-3" />
                                            <span className="text-xs">{material.name}</span>
                                          </>
                                        )}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                          } catch (e) {
                            // Ignore parsing errors
                          }
                          return null;
                        })()}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="students" className="space-y-4 md:space-y-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold">
                {t('classroomDetail.studentsTab.title')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('classroomDetail.studentsTab.subtitle')}
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('common.students')} ({students.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No students enrolled yet</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {students.map((enrollment) => {
                      const hasName = enrollment.student_profiles?.full_name;
                      const displayName = hasName
                        ? enrollment.student_profiles.full_name
                        : 'Student (Onboarding Incomplete)';
                      const initials = hasName
                        ? enrollment.student_profiles.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                        : 'S';

                      return (
                        <div
                          key={enrollment.id}
                          className="flex items-center gap-3 p-3 border rounded-lg"
                        >
                          <Avatar className="h-10 w-10">
                            {enrollment.student_profiles?.avatar_url && (
                              <AvatarImage
                                src={enrollment.student_profiles.avatar_url}
                                alt={displayName}
                              />
                            )}
                            <AvatarFallback>{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-medium truncate ${!hasName ? 'text-muted-foreground italic' : ''}`}
                            >
                              {displayName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t('classroomDetail.studentsTab.joined')}:{' '}
                              {new Date(enrollment.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submissions" className="space-y-4 md:space-y-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold">
                {t('classroomDetail.submissions.title')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('classroomDetail.submissions.subtitle')}
              </p>
            </div>
            <SubmissionsTab classroomId={id!} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 md:h-6 md:w-6" />
                <h2 className="text-xl md:text-2xl font-bold">{t('classroomDetail.analytics')}</h2>
              </div>
              <RegenerateScoresButton classroomId={id!} onComplete={fetchClassroom} />
            </div>
            <ClassroomAnalytics classroomId={id!} />
          </TabsContent>
        </Tabs>
      </main>

      <EditClassroomDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        classroom={classroom!}
        onSuccess={fetchClassroom}
      />

      <CreateAssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        classroomId={id!}
        onSuccess={fetchAssignments}
      />

      {selectedAssignment && (
        <EditAssignmentDialog
          open={editAssignmentDialogOpen}
          onOpenChange={setEditAssignmentDialogOpen}
          assignment={selectedAssignment}
          onSuccess={fetchAssignments}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this classroom?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>This action cannot be undone. This will permanently delete:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>
                    <strong>{assignments.length}</strong> assignment
                    {assignments.length !== 1 ? 's' : ''}
                  </li>
                  <li>
                    <strong>{students.length}</strong> enrolled student
                    {students.length !== 1 ? 's' : ''}
                  </li>
                  <li>All submissions and feedback</li>
                  <li>All analytics data</li>
                </ul>
                <p className="font-semibold text-destructive mt-4">Classroom: {classroom?.name}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteClassroom}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Classroom'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClassroomDetail;
