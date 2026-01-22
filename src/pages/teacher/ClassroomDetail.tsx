import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Users,
  BookOpen,
  Calendar,
  Plus,
  Edit,
  BarChart3,
  Trash2,
  FileText,
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { EditClassroomDialog } from '@/components/EditClassroomDialog';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { EditAssignmentDialog } from '@/components/EditAssignmentDialog';
import { ClassroomAnalytics } from '@/components/ClassroomAnalytics';
import { SubmissionsTab } from '@/components/SubmissionsTab';
import { RegenerateScoresButton } from '@/components/RegenerateScoresButton';
import { ClassroomLayout } from '@/components/layouts';
import SafeMathMarkdown from '@/components/SafeMathMarkdown';
import { useStaggerAnimation } from '@/hooks/useGsapAnimations';
import { useClassroom, useClassroomAssignments, useClassroomStudents, useDeleteAssignment } from '@/hooks/queries';

interface CourseMaterial {
  type: 'pdf' | 'link';
  url: string;
  name: string;
}

interface Domain {
  name: string;
  components: string[];
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
  domains: Domain[] | null;
  materials: CourseMaterial[] | null;
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
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const { data: rawClassroom, isLoading: classroomLoading, refetch: refetchClassroom } = useClassroom(id);
  const { data: rawAssignments = [], isLoading: assignmentsLoading, refetch: refetchAssignments } = useClassroomAssignments(id);
  const { data: students = [], isLoading: studentsLoading } = useClassroomStudents(id);
  const deleteAssignmentMutation = useDeleteAssignment();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [editAssignmentDialogOpen, setEditAssignmentDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState<Set<number>>(new Set());
  const [activeSection, setActiveSection] = useState('overview');

  // Memoize data transformations
  const assignments = useMemo(() => rawAssignments as unknown as Assignment[], [rawAssignments]);

  const classroom = useMemo(() => rawClassroom ? {
    ...rawClassroom,
    learning_outcomes: Array.isArray(rawClassroom.learning_outcomes) ? rawClassroom.learning_outcomes.map(String) : null,
    key_challenges: Array.isArray(rawClassroom.key_challenges) ? rawClassroom.key_challenges.map(String) : null,
    domains: (rawClassroom as any).domains as Domain[] | null,
    materials: (rawClassroom as any).materials as CourseMaterial[] | null,
  } as unknown as Classroom : null, [rawClassroom]);

  // GSAP stagger animation refs - only trigger on section/tab change or data length changes
  const assignmentsRef = useStaggerAnimation(':scope > div', 0.05, [activeSection, assignments.length]);
  const studentsRef = useStaggerAnimation(':scope > div', 0.04, [activeSection, students.length]);

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;

    try {
      await deleteAssignmentMutation.mutateAsync({ assignmentId, classroomId: id! });
      toast.success(t('classroomDetail.success.assignmentDeleted'));
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

  const toggleDomain = (index: number) => {
    setExpandedDomains(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  if (classroomLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!classroom) {
    return null;
  }

  // Define classroom sections with translated titles
  const classroomSections = [
    { id: 'overview', title: t('studentClassroom.about'), icon: Info },
    { id: 'assignments', title: t('studentClassroom.assignments'), icon: BookOpen },
    { id: 'students', title: t('classroomDetail.students'), icon: Users },
    { id: 'submissions', title: t('classroomDetail.submissionsTab'), icon: FileText },
    { id: 'analytics', title: t('classroomDetail.analytics'), icon: BarChart3 },
  ];

  return (
    <ClassroomLayout
      classroomName={classroom.name}
      classroomSubject={classroom.subject}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      customSections={classroomSections}
    >
      <div className="space-y-6 md:space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            <h2 className={`text-2xl md:text-3xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('classroomDetail.overview.title')}
            </h2>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Invite Code Card */}
              <Card className="md:col-span-2 lg:col-span-3 rounded-xl border-none shadow-sm bg-muted/30 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('classroomDetail.inviteCode')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 justify-start">
                    <div className="bg-card/80 backdrop-blur-sm px-6 py-3 rounded-lg border border-border shadow-sm">
                      <code className="text-3xl font-mono font-bold text-primary tracking-wider">
                        {classroom.invite_code}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full hover:bg-card/50"
                      onClick={() => {
                        navigator.clipboard.writeText(classroom.invite_code);
                        toast.success(t('classroomDetail.copiedToClipboard'));
                      }}
                    >
                      <LinkIcon className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </div>
                  <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('classroomDetail.shareCode')}
                  </p>
                </CardContent>
              </Card>

              {/* Course Info */}
              {classroom.course_title && (
                <Card className="rounded-xl border-none shadow-sm bg-card ring-1 ring-border" dir={isRTL ? 'rtl' : 'ltr'}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 bg-muted/50 rounded-xl">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                      </div>
                      {t('classroomDetail.overview.courseInfo')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <h3 className={`text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('classroomDetail.overview.courseTitle')}
                      </h3>
                      <p className={`font-medium text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{classroom.course_title}</p>
                    </div>

                    {classroom.course_duration && (
                      <div>
                        <h3 className={`text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('classroomDetail.overview.duration')}
                        </h3>
                        <p className={`font-medium text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{classroom.course_duration}</p>
                      </div>
                    )}

                    {(classroom.start_date || classroom.end_date) && (
                      <div>
                        <h3 className={`text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('classroomDetail.overview.courseDates')}
                        </h3>
                        <div className={`text-foreground/80 space-y-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {classroom.start_date && (
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                              <span className="text-sm">{t('common.start')}: {new Date(classroom.start_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {classroom.end_date && (
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                              <span className="text-sm">{t('common.end')}: {new Date(classroom.end_date).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Outline & Resources */}
              {(classroom.course_outline || classroom.resources) && (
                <Card className="md:col-span-2 lg:col-span-2 rounded-xl border-none shadow-sm bg-card ring-1 ring-border" dir={isRTL ? 'rtl' : 'ltr'}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 bg-muted/50 rounded-xl">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      {t('classroomDetail.details')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {classroom.course_outline && (
                      <div>
                        <h3 className={`text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('classroomDetail.overview.courseOutline')}
                        </h3>
                        <p className={`text-foreground/80 whitespace-pre-wrap leading-relaxed bg-muted/30 p-4 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}>
                          {classroom.course_outline}
                        </p>
                      </div>
                    )}

                    {classroom.resources && (
                      <div>
                        <h3 className={`text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('classroomDetail.overview.resources')}
                        </h3>
                        <p className={`text-foreground/80 whitespace-pre-wrap leading-relaxed bg-muted/30 p-4 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}>
                          {classroom.resources}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Learning Outcomes & Challenges */}
              {(classroom.learning_outcomes?.length || classroom.key_challenges?.length) ? (
                <Card className="md:col-span-2 lg:col-span-3 rounded-xl border-none shadow-sm bg-card ring-1 ring-border" dir={isRTL ? 'rtl' : 'ltr'}>
                  <CardContent className="p-6 grid md:grid-cols-2 gap-8">
                    {classroom.learning_outcomes && classroom.learning_outcomes.length > 0 && (
                      <div>
                        <h3 className={`flex items-center gap-2 font-bold text-lg mb-4 text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                          <span className="p-1.5 bg-muted/50 rounded-lg text-muted-foreground">
                            <BarChart3 className="h-4 w-4" />
                          </span>
                          {t('classroomDetail.overview.learningOutcomes')}
                        </h3>
                        <ul className="space-y-3">
                          {classroom.learning_outcomes.map((outcome: string, index: number) => (
                            <li key={index} className={`flex items-start gap-3 text-foreground/80 bg-muted/30 p-3 rounded-xl ${isRTL ? 'text-right' : 'text-left'}`}>
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted/50 text-muted-foreground flex items-center justify-center text-xs font-bold mt-0.5">
                                {index + 1}
                              </span>
                              <span className="text-sm leading-relaxed">{outcome}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {classroom.key_challenges && classroom.key_challenges.length > 0 && (
                      <div>
                        <h3 className={`flex items-center gap-2 font-bold text-lg mb-4 text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                          <span className="p-1.5 bg-muted/50 rounded-lg text-muted-foreground">
                            <Users className="h-4 w-4" />
                          </span>
                          {t('classroomDetail.overview.keyChallenges')}
                        </h3>
                        <ul className="space-y-3">
                          {classroom.key_challenges.map((challenge: string, index: number) => (
                            <li key={index} className={`flex items-start gap-3 text-foreground/80 bg-muted/30 p-3 rounded-xl ${isRTL ? 'text-right' : 'text-left'}`}>
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted/50 text-muted-foreground flex items-center justify-center text-xs font-bold mt-0.5">
                                !
                              </span>
                              <span className="text-sm leading-relaxed">{challenge}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </div>

            {/* Domains & Components Section */}
            {classroom.domains && classroom.domains.length > 0 && (
              <Card className="rounded-xl border-none shadow-sm bg-card ring-1 ring-border" dir={isRTL ? 'rtl' : 'ltr'}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-muted/50 rounded-xl">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                    </div>
                    {t('classroomDetail.subjectAreas')}
                  </CardTitle>
                  <CardDescription className={isRTL ? 'text-right' : 'text-left'}>{t('classroomDetail.subjectAreasDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {classroom.domains.map((domain, index) => (
                    <div key={index} className="border border-border rounded-lg overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors bg-card/30"
                        onClick={() => toggleDomain(index)}
                      >
                        <span className={`font-semibold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                          {domain.name}
                        </span>
                        {expandedDomains.has(index) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                      {expandedDomains.has(index) && (
                        <div className="px-4 pb-4 pt-2 bg-muted/30 space-y-2">
                          <p className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('classroomDetail.skills')}</p>
                          <div className={`flex flex-wrap gap-2 ${isRTL ? 'justify-end' : 'justify-start'}`}>
                            {domain.components.map((component, compIndex) => (
                              <Badge key={compIndex} variant="secondary" className="bg-card text-foreground border border-border rounded-lg px-3 py-1 font-normal">
                                {component}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Course Materials Section */}
            {classroom.materials && classroom.materials.length > 0 && (
              <Card className="rounded-xl border-none shadow-sm bg-card ring-1 ring-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-muted/50 rounded-xl">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    {t('classroomDetail.courseMaterials')}
                  </CardTitle>
                  <CardDescription className={isRTL ? 'text-right' : 'text-left'}>{t('classroomDetail.courseMaterialsDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {classroom.materials.map((material, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start h-auto py-4 px-4 rounded-lg border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                        onClick={() => window.open(material.url, '_blank')}
                      >
                        <div className="p-2 bg-muted rounded-xl me-3 group-hover:bg-card transition-colors">
                          {material.type === 'pdf' ? (
                            <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                          ) : (
                            <LinkIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                          )}
                        </div>
                        <div className={`flex-1 overflow-hidden ${isRTL ? 'text-right' : 'text-left'}`}>
                          <span className="block font-medium text-foreground truncate group-hover:text-primary transition-colors">{material.name}</span>
                          <span className="text-xs text-muted-foreground capitalize">{material.type}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Classroom Actions */}
            <div className="pt-6 border-t border-border">
              <div className={`flex flex-col sm:flex-row gap-3 ${isRTL ? 'sm:justify-end' : 'sm:justify-start'}`}>
                <Button
                  onClick={() => setEditDialogOpen(true)}
                  size="sm"
                  className="w-full sm:w-auto"
                  variant="outline"
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
          </div>
        )}

        {/* Assignments Section */}
        {activeSection === 'assignments' && (
          <div className="space-y-6">
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
              <Button
                onClick={() => setAssignmentDialogOpen(true)}
                className={`w-full sm:w-auto shadow-md hover:shadow-lg transition-all ${isRTL ? 'sm:order-1' : 'sm:order-2'}`}
              >
                <Plus className="me-2 h-4 w-4" />
                {t('classroomDetail.createAssignment')}
              </Button>
              <div className={`${isRTL ? 'text-right sm:order-2' : 'text-left sm:order-1'}`}>
                <h2 className={`text-2xl md:text-3xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('classroomDetail.assignments')}
                </h2>
                <p className={`text-muted-foreground mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('classroomDetail.assignmentsSubtitle')}
                </p>
              </div>
            </div>

            {assignments.length === 0 ? (
              <Card className="rounded-xl border-dashed border-2 border-border bg-muted/20">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center shadow-sm mb-4">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {t('classroomDetail.noAssignments')}
                  </h3>
                  <p className="text-muted-foreground max-w-md mb-6">
                    {t('classroomDetail.noAssignmentsDesc')}
                  </p>
                  <Button onClick={() => setAssignmentDialogOpen(true)}>
                    <Plus className="me-2 h-4 w-4" />
                    {t('classroomDetail.createAssignment')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div ref={assignmentsRef} className="grid gap-4">
                {assignments.map((assignment) => (
                  <Card key={assignment.id} className="group rounded-xl border-none shadow-sm hover:shadow-md transition-all bg-card ring-1 ring-border overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <CardTitle className={`text-lg font-bold text-foreground truncate ${isRTL ? 'text-right' : 'text-left'}`}>
                              {assignment.title}
                            </CardTitle>
                            {assignment.assigned_student_id && (
                              <Badge
                                variant="outline"
                                className="rounded-full bg-primary/10 text-primary border-primary/20"
                              >
                                {t('classroomDetail.assignedTo')} {assignment.student_profiles?.full_name || t('common.student')}
                              </Badge>
                            )}
                            <Badge
                              variant={assignment.status === 'published' ? 'default' : 'secondary'}
                              className={`rounded-full px-3 font-normal ${assignment.status === 'published'
                                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                            >
                              {t(`assignments.status.${assignment.status}`)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                              {t('classroomDetail.type')} {t(`assignments.types.${assignment.type}`)}
                            </span>
                            {assignment.due_at && (
                              <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                                {t('classroomDetail.due')} {new Date(assignment.due_at).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full hover:bg-muted"
                            onClick={() => {
                              setSelectedAssignment(assignment);
                              setEditAssignmentDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDeleteAssignment(assignment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className={`text-sm text-foreground/80 bg-muted/30 p-4 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}>
                        <SafeMathMarkdown content={assignment.instructions} />
                      </div>

                      {/* Course Materials */}
                      {assignment.materials &&
                        (() => {
                          try {
                            const materials: CourseMaterial[] = typeof assignment.materials === 'string'
                              ? JSON.parse(assignment.materials)
                              : assignment.materials;
                            if (Array.isArray(materials) && materials.length > 0) {
                              return (
                                <div className="pt-2">
                                  <p className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {t('classroomDetail.attachments')} ({materials.length})
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {materials.map((material, index) => (
                                      <Button
                                        key={index}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(material.url, '_blank')}
                                        className="gap-2 rounded-xl border-border bg-card"
                                      >
                                        {material.type === 'pdf' ? (
                                          <FileText className="h-3.5 w-3.5 text-destructive" />
                                        ) : (
                                          <LinkIcon className="h-3.5 w-3.5 text-primary" />
                                        )}
                                        <span className="text-xs font-medium">{material.name}</span>
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
          </div>
        )}

        {/* Students Section */}
        {activeSection === 'students' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-2xl md:text-3xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('classroomDetail.studentsTab.title')}
              </h2>
              <p className={`text-muted-foreground mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('classroomDetail.studentsTab.subtitle')}
              </p>
            </div>

            <Card className="rounded-xl border-none shadow-sm bg-card ring-1 ring-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  {t('common.students')} ({students.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                      <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">{t('classroomDetail.studentsTab.noStudents')}</p>
                  </div>
                ) : (
                  <div ref={studentsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {students.map((enrollment) => {
                      const hasName = enrollment.student_profiles?.full_name;
                      const displayName = hasName
                        ? enrollment.student_profiles.full_name
                        : t('classroomDetail.studentsTab.studentIncomplete');
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
                          className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors bg-card/30"
                        >
                          <Avatar className="h-12 w-12 border-2 border-card shadow-sm">
                            {enrollment.student_profiles?.avatar_url && (
                              <AvatarImage
                                src={enrollment.student_profiles.avatar_url}
                                alt={displayName}
                              />
                            )}
                            <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-bold text-foreground truncate ${!hasName ? 'text-muted-foreground italic' : ''}`}
                            >
                              {displayName}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Calendar className="h-3 w-3" />
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
          </div>
        )}

        {/* Submissions Section */}
        {activeSection === 'submissions' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-2xl md:text-3xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('classroomDetail.submissions.title')}
              </h2>
              <p className={`text-muted-foreground mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('classroomDetail.submissions.subtitle')}
              </p>
            </div>
            <SubmissionsTab classroomId={id!} />
          </div>
        )}

        {/* Analytics Section */}
        {activeSection === 'analytics' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-muted/50 rounded-xl">
                  <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                </div>
                <h2 className={`text-2xl md:text-3xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('classroomDetail.analytics')}
                </h2>
              </div>
              <RegenerateScoresButton classroomId={id!} onComplete={refetchClassroom} />
            </div>
            <ClassroomAnalytics classroomId={id!} />
          </div>
        )}
      </div>

      <EditClassroomDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        classroom={classroom!}
        onSuccess={refetchClassroom}
      />

      <CreateAssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        classroomId={id!}
        onSuccess={refetchAssignments}
      />

      {selectedAssignment && (
        <EditAssignmentDialog
          open={editAssignmentDialogOpen}
          onOpenChange={setEditAssignmentDialogOpen}
          assignment={selectedAssignment}
          onSuccess={refetchAssignments}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
            <AlertDialogTitle>{t('classroomDetail.deleteDialog.title')}</AlertDialogTitle>
            <div className={`space-y-2 ${isRTL ? 'text-right' : 'text-left'} text-sm text-muted-foreground`}>
              <p>{t('classroomDetail.deleteDialog.description')}</p>
              <ul className={`list-disc space-y-1 text-sm ${isRTL ? 'list-inside pr-4' : 'list-inside pl-4'}`}>
                <li>
                  <strong>{assignments.length}</strong> {assignments.length !== 1 ? t('classroomDetail.deleteDialog.assignmentCountPlural') : t('classroomDetail.deleteDialog.assignmentCount')}
                </li>
                <li>
                  <strong>{students.length}</strong> {students.length !== 1 ? t('classroomDetail.deleteDialog.studentCountPlural') : t('classroomDetail.deleteDialog.studentCount')}
                </li>
                <li>{t('classroomDetail.deleteDialog.allSubmissions')}</li>
                <li>{t('classroomDetail.deleteDialog.allAnalytics')}</li>
              </ul>
              <p className="font-semibold text-destructive mt-4">{t('classroomDetail.deleteDialog.classroomLabel')} {classroom?.name}</p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRTL ? 'flex-row-reverse justify-start gap-2' : 'flex-row justify-end gap-2'}>
            <AlertDialogCancel disabled={isDeleting} className="mt-0">{t('classroomDetail.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteClassroom}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('classroomDetail.deleteDialog.deleting') : t('classroomDetail.deleteDialog.deleteButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClassroomLayout>
  );
};

export default ClassroomDetail;
