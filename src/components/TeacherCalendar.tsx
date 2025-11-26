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
      <Card className="border-none shadow-lg rounded-[32px]">
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-white dark:bg-slate-900">
      <div className="p-6 pb-0">
        <div className="flex items-center gap-2 mb-6">
          <CalendarIcon className="h-6 w-6" />
          <h2 className="text-2xl font-bold">{t('calendar.title')}</h2>
        </div>
      </div>

      <CardContent className="p-6 pt-0 space-y-6">
        <div className="border rounded-3xl p-4">
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
              nav_button: "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 border rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all",
              nav_button_previous: "absolute start-1",
              nav_button_next: "absolute end-1",
              table: "w-full border-collapse space-y-1",
              head_row: "flex w-full justify-between mb-2",
              head_cell: "text-muted-foreground w-9 font-normal text-[10px] uppercase tracking-wider text-center",
              row: "flex w-full mt-2 justify-between",
              cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent",
              day: "h-9 w-9 p-0 font-normal text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all",
              day_selected: "!bg-black !text-white hover:!bg-black hover:!text-white focus:!bg-black focus:!text-white rounded-full shadow-md",
              day_today: "text-indigo-600 font-bold",
            }}
          />
        </div>

        {selectedDate && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="font-bold text-lg">
              {format(selectedDate, 'MMMM d, yyyy', { locale: language === 'he' ? he : undefined })}
            </h3>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {t('calendar.activeClasses')} ({activeClassesForSelectedDate.length})
              </h4>

              {activeClassesForSelectedDate.length > 0 ? (
                <div className="space-y-2">
                  {activeClassesForSelectedDate.map((classroom) => (
                    <div
                      key={classroom.id}
                      className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 transition-all hover:scale-[1.02]"
                    >
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{classroom.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{classroom.subject}</p>
                      {classroom.start_date && classroom.end_date && (
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">
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
                <p className="text-xs text-muted-foreground ps-1">{t('calendar.noActiveClasses')}</p>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-red-500 dark:text-red-400">
                {t('calendar.assignmentsDue')}
              </h4>

              {assignmentsForSelectedDate.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  {t('calendar.noAssignmentsDue')}
                </p>
              ) : (
                <div className="space-y-3">
                  {assignmentsForSelectedDate.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 transition-all hover:scale-[1.02]"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{assignment.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {assignment.classrooms.name}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-white dark:bg-slate-900 border-red-200 text-red-600">
                          {assignment.type.replace('_', ' ')}
                        </Badge>
                      </div>

                      {/* Completion Status Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Progress</span>
                          <span>{Math.round(((assignment.totalStudents - assignment.incompleteStudents.length) / assignment.totalStudents) * 100)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-red-400 to-pink-500 rounded-full transition-all duration-500"
                            style={{ width: `${((assignment.totalStudents - assignment.incompleteStudents.length) / assignment.totalStudents) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Incomplete Students */}
                      {assignment.incompleteStudents.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-red-100 dark:border-red-900/30">
                          <div className="flex items-center gap-1.5 text-[10px] text-red-600 dark:text-red-400 mb-2 font-medium">
                            <AlertCircle className="h-3 w-3" />
                            <span>{assignment.incompleteStudents.length} pending submissions</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {assignment.incompleteStudents.slice(0, 5).map((student) => (
                              <Avatar key={student.user_id} className="h-5 w-5 border border-white dark:border-slate-900">
                                {student.avatar_url && (
                                  <AvatarImage src={student.avatar_url} alt={student.full_name} />
                                )}
                                <AvatarFallback className="text-[8px] bg-red-100 text-red-700">
                                  {student.full_name?.charAt(0) || '?'}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {assignment.incompleteStudents.length > 5 && (
                              <div className="h-5 w-5 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center border border-white dark:border-slate-900 text-[8px] font-medium text-red-600">
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
