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
  const { language = 'en' } = useLanguage();
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
    <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-card">
      <div className="p-6 pb-0">
        <div className="flex items-center gap-2 mb-6">
          <CalendarIcon className="h-6 w-6 text-foreground" />
          <h2 className="text-2xl font-bold text-foreground">{t('calendar.title')}</h2>
        </div>
      </div>

      <CardContent className="p-6 pt-0 space-y-6">
        <div className="border border-border rounded-xl p-3 calendar-custom-selected">
          <div className="flex flex-col items-center mb-2">
            <div className="text-sm font-bold uppercase tracking-wider mb-1 text-foreground">
              {format(month, 'MMMM yyyy', { locale: language === 'he' ? he : undefined })}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))}
                className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-border rounded-full hover:bg-muted transition-all flex items-center justify-center"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-foreground" />
              </button>
              <button
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))}
                className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-border rounded-full hover:bg-muted transition-all flex items-center justify-center"
              >
                <ChevronRight className="h-3.5 w-3.5 text-foreground" />
              </button>
            </div>
          </div>
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
              month: "flex flex-col items-center w-full",
              caption: "hidden",
              caption_label: "hidden",
              nav: "hidden",
              nav_button: "hidden",
              nav_button_previous: "hidden",
              nav_button_next: "hidden",
              table: "border-collapse mx-auto",
              head_row: "flex justify-center gap-1 mb-1",
              head_cell: "text-muted-foreground w-8 font-normal text-[10px] uppercase tracking-wider text-center",
              row: "flex mt-1 justify-center gap-1",
              cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent flex items-center justify-center w-8",
              day: "h-8 w-8 p-0 font-normal text-sm hover:bg-muted rounded-full transition-all flex items-center justify-center text-foreground",
              day_selected: "!bg-primary !text-primary-foreground hover:!bg-primary/90 hover:!text-primary-foreground focus:!bg-primary focus:!text-primary-foreground rounded-full shadow-sm scale-90",
              day_today: "text-primary font-bold ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
            }}
          />
        </div>

        {selectedDate && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="font-bold text-lg text-foreground">
              {format(selectedDate, 'MMMM d, yyyy', { locale: language === 'he' ? he : undefined })}
            </h3>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {t('calendar.activeClasses')} ({activeClassesForSelectedDate.length})
              </h4>

              {activeClassesForSelectedDate.length > 0 ? (
                <div className="space-y-2">
                  {activeClassesForSelectedDate.map((classroom) => (
                    <div
                      key={classroom.id}
                      className="p-4 rounded-lg bg-primary/10 border border-primary/20 transition-all hover:scale-[1.02]"
                    >
                      <p className="font-bold text-sm text-foreground">{classroom.name}</p>
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
                <p className="text-xs text-muted-foreground ps-1">{t('calendar.noActiveClasses')}</p>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-destructive">
                {t('calendar.assignmentsDue')}
              </h4>

              {assignmentsForSelectedDate.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('calendar.noAssignmentsDue')}
                </p>
              ) : (
                <div className="space-y-2">
                  {assignmentsForSelectedDate.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 transition-all hover:scale-[1.02]"
                    >
                      <p className="font-bold text-sm text-foreground">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {assignment.classrooms.name}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px] bg-card border-destructive/30 text-destructive">
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
