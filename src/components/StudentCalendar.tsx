import { useState, useMemo, useCallback } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getActiveClassroomsForDate,
  getAssignmentsForDate,
  isDateInClassRange,
  CALENDAR_MODIFIERS_STYLES,
} from '@/lib/calendarUtils';
import { useStudentCalendarData } from '@/hooks/queries';

interface StudentCalendarProps {
  studentId: string;
}

export function StudentCalendar({
  studentId,
}: StudentCalendarProps) {
  const { t } = useTranslation();
  const { language = 'en' } = useLanguage();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState<Date>(new Date());

  const { data, isLoading: loading } = useStudentCalendarData(studentId);

  const assignments = data?.assignments || [];
  const classrooms = data?.classrooms || [];

  const datesWithAssignments = useMemo(
    () => assignments.map((a: any) => new Date(a.due_at)),
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

  if (loading && !data) {
    return (
      <Card className="border-none shadow-lg rounded-[32px]">
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <p>{t('common.loading')}</p>
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
