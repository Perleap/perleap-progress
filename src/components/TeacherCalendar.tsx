import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { format, isSameDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { Calendar as CalendarIcon, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { CALENDAR_MODIFIERS_STYLES } from '@/lib/calendarUtils';

// Utility function for date range checking
const isDateInRange = (date: Date, startDate: string | null, endDate: string | null): boolean => {
  if (!startDate && !endDate) return true;

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  if (start && date < start) return false;
  if (end && date > end) return false;

  return true;
};

interface Assignment {
  id: string;
  title: string;
  due_at: string;
  type: string;
  classroom_id: string;
  classrooms: {
    name: string;
    subject: string;
  };
}

interface Student {
  user_id: string;
  full_name: string;
  avatar_url?: string;
}

interface AssignmentWithIncomplete extends Assignment {
  incompleteStudents: Student[];
  totalStudents: number;
}

interface Classroom {
  id: string;
  name: string;
  subject: string;
  start_date: string | null;
  end_date: string | null;
}

interface TeacherCalendarProps {
  teacherId: string;
  classrooms?: Classroom[];
  loading?: boolean;
}

export function TeacherCalendar({
  teacherId,
  classrooms: propClassrooms,
  loading: propLoading,
}: TeacherCalendarProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  const [assignments, setAssignments] = useState<AssignmentWithIncomplete[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  // Add refs to prevent refetching when tabbing in/out
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastClassroomIdsRef = useRef<string | null>(null); // Use null as sentinel for "not initialized"
  const lastTeacherIdRef = useRef<string>('');

  const fetchAssignmentsOnly = useCallback(async (classroomIds: string[]) => {
    // Prevent duplicate fetches
    const classroomIdsKey = classroomIds.sort().join(',');
    if (isFetchingRef.current || (hasFetchedRef.current && lastClassroomIdsRef.current === classroomIdsKey)) {
      return;
    }

    isFetchingRef.current = true;

    try {
      // Fetch assignments with classroom info
      const { data: assignmentsData } = await supabase
        .from('assignments')
        .select('id, title, due_at, type, classroom_id, classrooms(name, subject)')
        .in('classroom_id', classroomIds)
        .eq('status', 'published')
        .order('due_at', { ascending: true });

      if (!assignmentsData) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      // Fetch all data in bulk to avoid N+1 queries
      const assignmentIds = assignmentsData.map((a) => a.id);

      // Get all enrollments for these classrooms
      const { data: allEnrollments } = await supabase
        .from('enrollments')
        .select('student_id, classroom_id')
        .in('classroom_id', classroomIds);

      // Get all submissions for these assignments
      const { data: allSubmissions } = await supabase
        .from('submissions')
        .select('student_id, assignment_id')
        .in('assignment_id', assignmentIds);

      // Get all unique student IDs
      const allStudentIds = [...new Set(allEnrollments?.map((e) => e.student_id) || [])];

      // Get all student profiles in one query
      const { data: allStudentProfiles } = await supabase
        .from('student_profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', allStudentIds);

      // Create lookup maps for fast access
      const enrollmentsByClassroom = new Map<string, string[]>();
      allEnrollments?.forEach((e) => {
        if (!enrollmentsByClassroom.has(e.classroom_id)) {
          enrollmentsByClassroom.set(e.classroom_id, []);
        }
        enrollmentsByClassroom.get(e.classroom_id)!.push(e.student_id);
      });

      const submissionsByAssignment = new Map<string, string[]>();
      allSubmissions?.forEach((s) => {
        if (!submissionsByAssignment.has(s.assignment_id)) {
          submissionsByAssignment.set(s.assignment_id, []);
        }
        submissionsByAssignment.get(s.assignment_id)!.push(s.student_id);
      });

      const studentProfilesMap = new Map<string, Student>();
      allStudentProfiles?.forEach((p) => {
        studentProfilesMap.set(p.user_id, p as Student);
      });

      // Process assignments with all data in memory
      const assignmentsWithIncomplete = assignmentsData.map((assignment: Assignment) => {
        const enrolledStudentIds = enrollmentsByClassroom.get(assignment.classroom_id) || [];
        const completedStudentIds = submissionsByAssignment.get(assignment.id) || [];
        const incompleteStudentIds = enrolledStudentIds.filter(
          (id) => !completedStudentIds.includes(id)
        );

        const incompleteStudents = incompleteStudentIds
          .map((id) => studentProfilesMap.get(id))
          .filter(Boolean) as Student[];

        return {
          ...assignment,
          incompleteStudents,
          totalStudents: enrolledStudentIds.length,
        };
      });

      setAssignments(assignmentsWithIncomplete);
      lastClassroomIdsRef.current = classroomIdsKey;
      hasFetchedRef.current = true;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    // Prevent duplicate fetches
    if (isFetchingRef.current || (hasFetchedRef.current && lastTeacherIdRef.current === teacherId)) {
      return;
    }

    isFetchingRef.current = true;

    try {
      const { data: classroomsData, error: classroomError } = await supabase
        .from('classrooms')
        .select('id, name, subject, start_date, end_date')
        .eq('teacher_id', teacherId);

      if (classroomError) throw classroomError;

      if (!classroomsData?.length) {
        setAssignments([]);
        setClassrooms([]);
        setLoading(false);
        hasFetchedRef.current = true;
        lastTeacherIdRef.current = teacherId;
        return;
      }

      setClassrooms(classroomsData);
      lastTeacherIdRef.current = teacherId;

      // Reset classroom fetch tracking when fetching all
      hasFetchedRef.current = false;
      await fetchAssignmentsOnly(classroomsData.map((c) => c.id));
    } catch {
      setLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
  }, [teacherId, fetchAssignmentsOnly]);

  useEffect(() => {
    // Reset fetch flags if teacherId changes
    if (lastTeacherIdRef.current !== teacherId) {
      hasFetchedRef.current = false;
      lastClassroomIdsRef.current = null;
      lastTeacherIdRef.current = teacherId;
    }

    if (propClassrooms !== undefined) {
      const classroomIds = propClassrooms.map((c) => c.id);
      const classroomIdsKey = classroomIds.sort().join(',');

      // Update if classrooms changed OR if this is the first render (null sentinel)
      if (lastClassroomIdsRef.current === null || lastClassroomIdsRef.current !== classroomIdsKey) {
        setClassrooms(propClassrooms);
        setLoading(propLoading ?? false);

        if (propClassrooms.length > 0) {
          hasFetchedRef.current = false; // Reset to allow fetch
          fetchAssignmentsOnly(classroomIds);
        } else {
          setAssignments([]);
          setLoading(false);
          hasFetchedRef.current = true;
          lastClassroomIdsRef.current = classroomIdsKey;
        }
      }
    } else {
      // Only fetch if we haven't fetched for this teacher yet
      if (!hasFetchedRef.current && !isFetchingRef.current) {
        fetchAssignments();
      }
    }
  }, [teacherId, propClassrooms, propLoading]);

  // Memoize assignment dates to avoid recalculating on every render
  const datesWithAssignments = useMemo(
    () => assignments.map((a) => new Date(a.due_at)),
    [assignments]
  );

  // Memoize assignments for selected date
  const assignmentsForSelectedDate = useMemo(
    () =>
      selectedDate ? assignments.filter((a) => isSameDay(new Date(a.due_at), selectedDate)) : [],
    [assignments, selectedDate]
  );

  // Memoize function to check if a date is within any classroom's active range
  const isDateInClassRange = useMemo(() => {
    return (date: Date) =>
      classrooms.some((classroom) => isDateInRange(date, classroom.start_date, classroom.end_date));
  }, [classrooms]);

  // Memoize active classes for selected date
  const activeClassesForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return classrooms.filter((classroom) =>
      isDateInRange(selectedDate, classroom.start_date, classroom.end_date)
    );
  }, [classrooms, selectedDate]);

  const modifiers = useMemo(
    () => ({
      hasAssignment: datesWithAssignments,
      hasClass: isDateInClassRange,
    }),
    [datesWithAssignments, isDateInClassRange]
  );

  if (loading) {
    return (
      <Card className="border border-border/50 shadow-xl rounded-2xl backdrop-blur-xl bg-gradient-to-br from-card/95 to-card/80">
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/50 shadow-xl rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 to-card/80 hover:shadow-2xl transition-shadow duration-300">
      <div className="p-6 pb-0 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
            <CalendarIcon className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{t('calendar.title')}</h2>
        </div>
      </div>

      <CardContent className="p-6 pt-0 space-y-6">
        <div className="border border-border/30 rounded-2xl p-4 bg-gradient-to-br from-muted/30 to-transparent backdrop-blur-sm">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={month}
            onMonthChange={setMonth}
            modifiers={modifiers}
            modifiersStyles={CALENDAR_MODIFIERS_STYLES}
            className="w-full"
            classNames={{
              month: "space-y-4 w-full",
              caption: "flex justify-center items-center relative pt-1 pb-6",
              caption_label: "text-base font-bold uppercase tracking-wider",
              nav: "flex items-center gap-1",
              nav_button: "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 border border-border/50 rounded-full hover:bg-primary/10 hover:border-primary/50 dark:hover:bg-primary/20 transition-all duration-300",
              nav_button_previous: "absolute start-1",
              nav_button_next: "absolute end-1",
              table: "w-full border-collapse space-y-1",
              head_row: "flex w-full justify-between mb-2",
              head_cell: "text-muted-foreground w-9 font-normal text-[10px] uppercase tracking-wider text-center",
              row: "flex w-full mt-2 justify-between",
              cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent",
              day: "h-9 w-9 p-0 font-normal text-sm hover:bg-primary/10 dark:hover:bg-primary/20 rounded-full transition-all duration-300 hover:scale-110",
              day_selected: "!bg-gradient-to-br !from-primary !to-primary/80 !text-white hover:!from-primary/90 hover:!to-primary/70 focus:!from-primary focus:!to-primary/80 rounded-full shadow-lg scale-110",
              day_today: "text-primary font-bold ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
            }}
          />
        </div>

        {selectedDate && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 rounded-xl border border-primary/20">
              <h3 className="font-bold text-lg text-primary">
                {format(selectedDate, 'MMMM d, yyyy', { locale: language === 'he' ? he : undefined })}
              </h3>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-primary flex items-center gap-2 bg-primary/5 px-3 py-2 rounded-lg">
                <CalendarIcon className="h-4 w-4" />
                {t('calendar.activeClasses')} ({activeClassesForSelectedDate.length})
              </h4>

              {activeClassesForSelectedDate.length > 0 ? (
                <div className="space-y-2">
                  {activeClassesForSelectedDate.map((classroom) => (
                    <div
                      key={classroom.id}
                      className="group p-4 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:border-primary/40 backdrop-blur-sm"
                    >
                      <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{classroom.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{classroom.subject}</p>
                      {classroom.start_date && classroom.end_date && (
                        <p className="text-[10px] text-muted-foreground mt-2 font-medium bg-background/50 px-2 py-1 rounded-md inline-block">
                          {format(new Date(classroom.start_date), 'MMM d', {
                            locale: language === 'he' ? he : undefined,
                          })}{' '}
                          -{' '}
                          {format(new Date(classroom.end_date), 'MMM d', {
                            locale: language === 'he' ? he : undefined,
                          })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground ps-1 py-2">{t('calendar.noActiveClasses')}</p>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-destructive flex items-center gap-2 bg-destructive/5 px-3 py-2 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                {t('calendar.assignmentsDue')}
              </h4>

              {assignmentsForSelectedDate.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  {t('calendar.noAssignmentsDue')}
                </p>
              ) : (
                <div className="space-y-3">
                  {assignmentsForSelectedDate.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="group p-4 rounded-xl bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent border border-destructive/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:border-destructive/40 backdrop-blur-sm"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-sm text-foreground group-hover:text-destructive transition-colors">{assignment.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {assignment.classrooms.name}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-background/80 border-destructive/30 text-destructive font-semibold">
                          {assignment.type.replace('_', ' ')}
                        </Badge>
                      </div>

                      {/* Enhanced Completion Status Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                          <span>Progress</span>
                          <span className="text-foreground">{Math.round(((assignment.totalStudents - assignment.incompleteStudents.length) / assignment.totalStudents) * 100)}%</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full bg-gradient-to-r from-primary via-primary to-primary/80 rounded-full transition-all duration-700 ease-out shadow-sm"
                            style={{ width: `${((assignment.totalStudents - assignment.incompleteStudents.length) / assignment.totalStudents) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Incomplete Students */}
                      {assignment.incompleteStudents.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-destructive/20">
                          <div className="flex items-center gap-1.5 text-[10px] text-destructive mb-2 font-semibold bg-destructive/5 px-2 py-1 rounded-md inline-flex">
                            <AlertCircle className="h-3 w-3" />
                            <span>{assignment.incompleteStudents.length} pending submissions</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {assignment.incompleteStudents.slice(0, 5).map((student) => (
                              <Avatar key={student.user_id} className="h-6 w-6 border-2 border-background shadow-sm ring-1 ring-destructive/20">
                                {student.avatar_url && (
                                  <AvatarImage src={student.avatar_url} alt={student.full_name} />
                                )}
                                <AvatarFallback className="text-[8px] bg-destructive/10 text-destructive font-semibold">
                                  {student.full_name?.charAt(0) || '?'}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {assignment.incompleteStudents.length > 5 && (
                              <div className="h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center border-2 border-background shadow-sm text-[8px] font-bold text-destructive ring-1 ring-destructive/20">
                                +{assignment.incompleteStudents.length - 5}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
