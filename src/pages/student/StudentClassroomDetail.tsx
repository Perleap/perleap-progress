import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { BookOpen, Calendar, FileText, Clock, CheckCircle2, AlertCircle, Sparkles, Info, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClassroomLayout } from '@/components/layouts';
import { useStaggerAnimation } from '@/hooks/useGsapAnimations';
import { useClassroom, useClassroomAssignments, useTeacherProfile } from '@/hooks/queries';

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
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const { data: rawClassroom, isLoading: classroomLoading } = useClassroom(id);
  const { data: rawAssignments = [], isLoading: assignmentsLoading } = useClassroomAssignments(id);
  
  const teacherId = rawClassroom?.teacher_id;
  const { data: teacher } = useTeacherProfile(teacherId);

  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'due-date'>('due-date');
  const [assignmentsSubTab, setAssignmentsSubTab] = useState<'active' | 'finished'>('active');
  const [activeSection, setActiveSection] = useState('overview');
  
  // GSAP stagger animation for assignments
  // Only animate on section/tab changes, not data length changes to prevent forced reflows
  const assignmentsListRef = useStaggerAnimation(':scope > div', 0.05, [activeSection, assignmentsSubTab]);
  
  // Transform data
  const classroom = rawClassroom as unknown as Classroom | null;
  const allAssignments = (rawAssignments as any[]).map(a => ({
    ...a,
    is_completed: a.submissions?.some((s: any) => 
      s.status === 'completed' || 
      (s.assignment_feedback && s.assignment_feedback.length > 0)
    ) || false
  })) as unknown as Assignment[];
  const assignments = allAssignments.filter((a: any) => !a.is_completed);
  const finishedAssignments = allAssignments.filter((a: any) => a.is_completed);

  const getSortedAssignments = (assignmentsList: Assignment[] = assignments) => {
    const sorted = [...assignmentsList];
    switch (sortBy) {
      case 'recent':
        return sorted.reverse();
      case 'oldest':
        return sorted;
      case 'due-date':
        return sorted.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
      default:
        return sorted;
    }
  };

  const loading = classroomLoading || assignmentsLoading;

  if (!classroom) return null;

  // Define classroom sections with translated titles
  const classroomSections = [
    { id: 'overview', title: t('studentClassroom.about'), icon: Info },
    { id: 'assignments', title: t('studentClassroom.assignments'), icon: BookOpen },
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
              {t('studentClassroom.about')}
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Main Info Card */}
              <Card className="md:col-span-2 border border-border shadow-sm rounded-xl bg-card overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                <CardHeader className="border-b border-border bg-muted/30">
                  <CardTitle className={`flex items-center gap-3 text-xl ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="p-2 bg-background rounded-lg border border-border">
                      <BookOpen className="h-5 w-5 text-foreground" />
                    </div>
                    {t('studentClassroom.courseInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {classroom.course_title && (
                    <div>
                      <h3 className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('studentClassroom.courseTitle')}</h3>
                      <p className={`text-lg font-semibold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{classroom.course_title}</p>
                    </div>
                  )}

                  {classroom.course_outline && (
                    <div>
                      <h3 className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('studentClassroom.courseOutline')}</h3>
                      <div className={`bg-muted/30 p-4 rounded-xl text-foreground/80 whitespace-pre-wrap leading-relaxed border border-border/50 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {classroom.course_outline}
                      </div>
                    </div>
                  )}

                  {classroom.resources && (
                    <div>
                      <h3 className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('studentClassroom.resources')}</h3>
                      <div className={`bg-muted/30 p-4 rounded-xl text-foreground/80 whitespace-pre-wrap leading-relaxed border border-border/50 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {classroom.resources}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sidebar Info */}
              <div className="space-y-6">
                {teacher && (
                  <Card className="border border-border shadow-sm rounded-xl bg-card overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                    <CardHeader className="pb-3 border-b border-border bg-muted/30">
                      <CardTitle className={`text-base flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center">
                          <Users className="h-4 w-4 text-foreground" />
                        </div>
                        {t('common.teacher')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-muted border-2 border-background shadow-sm overflow-hidden">
                          {teacher.avatar_url ? (
                            <img src={teacher.avatar_url} alt={teacher.full_name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-muted-foreground font-medium text-lg">
                              {teacher.full_name?.charAt(0) || 'T'}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-base text-foreground">{teacher.full_name}</p>
                          <p className="text-xs text-muted-foreground">{t('common.teacher')}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="border border-border shadow-sm rounded-xl bg-card overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                  <CardHeader className="pb-3 border-b border-border bg-muted/30">
                    <CardTitle className={`text-base flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <div className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-foreground" />
                      </div>
                      {t('studentClassroom.schedule')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    {classroom.course_duration && (
                      <div className="flex items-start gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">{t('studentClassroom.duration')}</p>
                          <p className="text-sm font-medium text-foreground">{classroom.course_duration}</p>
                        </div>
                      </div>
                    )}

                    {(classroom.start_date || classroom.end_date) && (
                      <div className="space-y-3 pt-2 border-t border-border/50">
                        {classroom.start_date && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground font-medium">{t('studentClassroom.startDate')}</span>
                            <Badge variant="outline" className="bg-muted/50 text-foreground border-border/50 font-mono text-[10px]">
                              {new Date(classroom.start_date).toLocaleDateString()}
                            </Badge>
                          </div>
                        )}
                        {classroom.end_date && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground font-medium">{t('studentClassroom.endDate')}</span>
                            <Badge variant="outline" className="bg-muted/50 text-foreground border-border/50 font-mono text-[10px]">
                              {new Date(classroom.end_date).toLocaleDateString()}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {classroom.learning_outcomes && classroom.learning_outcomes.length > 0 && (
                  <Card className="border border-border shadow-sm rounded-xl bg-card overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                    <CardHeader className="pb-3 border-b border-border bg-muted/30">
                      <CardTitle className={`text-base flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center text-success">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        {t('studentClassroom.learningOutcomes')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <ul className="space-y-2">
                        {classroom.learning_outcomes.map((outcome, index) => (
                          <li key={index} className={`flex items-start gap-2 text-sm text-foreground/80 ${isRTL ? 'text-right' : 'text-left'}`}>
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                            <span>{outcome}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {classroom.key_challenges && classroom.key_challenges.length > 0 && (
                  <Card className="border border-border shadow-sm rounded-xl bg-card overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                    <CardHeader className="pb-3 border-b border-border bg-muted/30">
                      <CardTitle className={`text-base flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center text-warning">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                        {t('studentClassroom.keyChallenges')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <ul className="space-y-2">
                        {classroom.key_challenges.map((challenge, index) => (
                          <li key={index} className={`flex items-start gap-2 text-sm text-foreground/80 ${isRTL ? 'text-right' : 'text-left'}`}>
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                            <span>{challenge}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Assignments Section */}
        {activeSection === 'assignments' && (
          <div className="space-y-6">
            <h2 className={`text-2xl md:text-3xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('studentClassroom.assignments')}
            </h2>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 bg-card p-4 rounded-xl shadow-sm">
              <div className="flex items-center bg-muted/50 p-1 rounded-full border border-border/50">
                <Tabs value={assignmentsSubTab} onValueChange={(v) => setAssignmentsSubTab(v as 'active' | 'finished')} className="w-full sm:w-auto">
                  <TabsList className="h-9 bg-transparent p-0 flex gap-1 border-none">
                    <TabsTrigger
                      value="active"
                      className="rounded-full px-6 py-1.5 text-sm font-medium text-muted-foreground data-active:bg-background data-active:text-foreground data-active:shadow-sm hover:text-foreground transition-all border-none"
                    >
                      {t('common.active')}
                    </TabsTrigger>
                    <TabsTrigger
                      value="finished"
                      className="rounded-full px-6 py-1.5 text-sm font-medium text-muted-foreground data-active:bg-background data-active:text-foreground data-active:shadow-sm hover:text-foreground transition-all border-none"
                    >
                      {t('common.finished')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {(assignmentsSubTab === 'active' ? assignments.length > 0 : finishedAssignments.length > 0) && (
                <Select
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value as typeof sortBy)}
                >
                  <SelectTrigger className="w-[180px] rounded-lg border-border bg-card">
                    <SelectValue placeholder={t('studentDashboard.sortBy')} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="due-date">{t('studentDashboard.sortOptions.dueDate')}</SelectItem>
                    <SelectItem value="recent">{t('studentDashboard.sortOptions.recent')}</SelectItem>
                    <SelectItem value="oldest">{t('studentDashboard.sortOptions.oldest')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {assignmentsSubTab === 'active' ? (
              assignments.length === 0 ? (
                <Card className="border-dashed border-2 border-border bg-muted/20 rounded-xl">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-foreground">
                      {t('studentClassroom.noAssignments')}
                    </h3>
                    <p className="text-muted-foreground max-w-md">
                      {t('studentClassroom.noAssignmentsDesc')}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div ref={assignmentsListRef} className="grid gap-4">
                  {getSortedAssignments().map((assignment) => (
                    <Card
                      key={assignment.id}
                      className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-none shadow-md rounded-xl bg-card overflow-hidden hover:-translate-y-1"
                      onClick={() => navigate(`/student/assignment/${assignment.id}`)}
                    >
                      <div className="flex flex-col md:flex-row">
                        <div className={`p-6 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                          <div className="flex items-center gap-3 mb-3">
                            <Badge className={cn(
                              "rounded-full px-3 py-1",
                              assignment.type === 'quiz' ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-primary/10 text-primary hover:bg-primary/20"
                            )}>
                              {t(`assignmentTypes.${assignment.type}`)}
                            </Badge>
                            {assignment.due_at && (
                              <span className="text-sm font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {t('common.due')}: {new Date(assignment.due_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          <h3 className={`text-xl font-bold mb-2 group-hover:text-primary transition-colors text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                            {assignment.title}
                          </h3>

                          <p className={`text-muted-foreground line-clamp-2 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {assignment.instructions}
                          </p>

                          <Button variant="outline" className="rounded-lg group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 transition-all">
                            {t('studentClassroom.viewAssignment')}
                          </Button>
                        </div>

                        <div className="w-full md:w-2 bg-primary" />
                      </div>
                    </Card>
                  ))}
                </div>
              )
            ) : (
              finishedAssignments.length === 0 ? (
                <Card className="border-dashed border-2 border-border bg-muted/20 rounded-xl">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-foreground">
                      {t('studentClassroom.noFinishedAssignments')}
                    </h3>
                    <p className="text-muted-foreground max-w-md">
                      {t('studentClassroom.noFinishedAssignmentsDesc')}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {getSortedAssignments(finishedAssignments).map((assignment) => (
                    <Card
                      key={assignment.id}
                      className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-none shadow-md rounded-xl bg-muted/20 overflow-hidden opacity-80 hover:opacity-100"
                      onClick={() => navigate(`/student/assignment/${assignment.id}`)}
                    >
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="secondary" className="rounded-full bg-muted text-muted-foreground">
                            {t(`assignmentTypes.${assignment.type}`)}
                          </Badge>
                          <Badge className="rounded-full bg-success/10 text-success hover:bg-success/20 border-none flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('common.completed')}
                          </Badge>
                        </div>

                        <h3 className="text-lg font-bold mb-2 text-foreground/80">
                          {assignment.title}
                        </h3>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{t('common.due')}: {new Date(assignment.due_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </ClassroomLayout>
  );
};

export default StudentClassroomDetail;
