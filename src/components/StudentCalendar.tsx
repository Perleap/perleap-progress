import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getActiveClassroomsForDate,
  getAssignmentsForDate,
  isDateInClassRange,
  CALENDAR_MODIFIERS_STYLES,
  type ClassroomDateRange,
} from '@/lib/calendarUtils';

interface Assignment {
  id: string;
  title: string;
  due_at: string;
  type: string;
  classrooms: {
    name: string;
    subject: string;
  };
}

interface Classroom extends ClassroomDateRange {
  id: string;
  name: string;
  subject: string;
}

interface StudentCalendarProps {
  studentId: string;
  assignments?: Assignment[];
  classrooms?: Classroom[];
  loading?: boolean;
}

export function StudentCalendar({
  studentId,
  assignments: propAssignments,
  classrooms: propClassrooms,
  loading: propLoading,
}: StudentCalendarProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  const [assignments, setAssignments] = useState<Assignment[]>(propAssignments || []);
  const [classrooms, setClassrooms] = useState<Classroom[]>(propClassrooms || []);
  const [loading, setLoading] = useState(
    propAssignments !== undefined && propClassrooms !== undefined
      ? (propLoading ?? false)
      : true
  );

  // Add refs to prevent refetching when tabbing in/out
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastStudentIdRef = useRef<string>('');
  const lastPropsKeyRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    // Prevent duplicate fetches
    if (isFetchingRef.current || (hasFetchedRef.current && lastStudentIdRef.current === studentId)) {
      return;
    }

    isFetchingRef.current = true;

    try {
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('classroom_id, classrooms(id, name, subject, start_date, end_date)')
        .eq('student_id', studentId);

      if (enrollError) throw enrollError;

      if (!enrollments?.length) {
        setAssignments([]);
        setClassrooms([]);
        setLoading(false);
        hasFetchedRef.current = true;
        lastStudentIdRef.current = studentId;
        return;
      }

      const classroomIds = enrollments.map((e) => e.classroom_id);
      const classroomsData = enrollments.map((e) => e.classrooms).filter(Boolean) as Classroom[];
      setClassrooms(classroomsData);

      const { data: assignmentsData, error: assignError } = await supabase
        .from('assignments')
        .select('id, title, due_at, type, classrooms(name, subject)')
        .in('classroom_id', classroomIds)
        .eq('status', 'published')
        .order('due_at', { ascending: true });

      if (assignError) throw assignError;

      setAssignments((assignmentsData as Assignment[]) || []);
      lastStudentIdRef.current = studentId;
      hasFetchedRef.current = true;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [studentId]);

  useEffect(() => {
    // Reset fetch flags if studentId changes
    if (lastStudentIdRef.current !== studentId) {
      hasFetchedRef.current = false;
      lastStudentIdRef.current = studentId;
    }

    if (propAssignments !== undefined && propClassrooms !== undefined) {
      // Create a key from props to detect changes
      const propsKey = `${propAssignments.length}-${propClassrooms.length}`;

      // Initialize the ref on first render or update if props changed
      if (lastPropsKeyRef.current === '') {
        // First render with props - sync loading state
        lastPropsKeyRef.current = propsKey;
        hasFetchedRef.current = true;
        setLoading(propLoading ?? false);
      } else if (lastPropsKeyRef.current !== propsKey) {
        // Props changed - update state
        setAssignments(propAssignments);
        setClassrooms(propClassrooms);
        setLoading(propLoading ?? false);
        lastPropsKeyRef.current = propsKey;
        hasFetchedRef.current = true;
      } else if (propLoading !== undefined && loading !== propLoading) {
        // Only loading state changed
        setLoading(propLoading);
      }
    } else {
      // Only fetch if we haven't fetched for this student yet
      if (!hasFetchedRef.current && !isFetchingRef.current) {
        fetchData();
      }
    }
  }, [studentId, propAssignments, propClassrooms, propLoading, loading, fetchData]);

  const datesWithAssignments = useMemo(
    () => assignments.map((a) => new Date(a.due_at)),
    [assignments]
  );

  const assignmentsForSelectedDate = useMemo(
    () => (selectedDate ? getAssignmentsForDate(selectedDate, assignments) : []),
    [assignments, selectedDate]
  );

  const checkDateInClassRange = useCallback(
    (date: Date) => isDateInClassRange(date, classrooms),
    [classrooms]
  );

  const activeClassesForSelectedDate = useMemo(
    () => (selectedDate ? getActiveClassroomsForDate(selectedDate, classrooms) : []),
    [classrooms, selectedDate]
  );

  const modifiers = useMemo(
    () => ({
      hasAssignment: datesWithAssignments,
      hasClass: checkDateInClassRange,
    }),
    [datesWithAssignments, checkDateInClassRange]
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
        <div className="border rounded-xl p-4">
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
              day_today: "text-primary font-bold",
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
                      className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 transition-all hover:scale-[1.02]"
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
                <div className="space-y-2">
                  {assignmentsForSelectedDate.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 transition-all hover:scale-[1.02]"
                    >
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{assignment.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {assignment.classrooms.name}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px] bg-white dark:bg-slate-900 border-red-200 text-red-600">
                          {assignment.type.replace('_', ' ')}
                        </Badge>
                      </div>
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
