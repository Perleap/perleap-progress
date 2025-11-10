import { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import {
  getActiveClassroomsForDate,
  getAssignmentsForDate,
  isDateInClassRange,
  CALENDAR_MODIFIERS_STYLES,
  type ClassroomDateRange,
} from "@/lib/calendarUtils";

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

interface Classroom extends ClassroomDateRange {}

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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("classroom_id, classrooms(id, name, subject, start_date, end_date)")
        .eq("student_id", studentId);

      if (enrollError) throw enrollError;

      if (!enrollments?.length) {
        setAssignments([]);
        setClassrooms([]);
        return;
      }

      const classroomIds = enrollments.map((e) => e.classroom_id);
      const classroomsData = enrollments
        .map((e) => e.classrooms)
        .filter(Boolean) as Classroom[];
      setClassrooms(classroomsData);

      const { data: assignmentsData, error: assignError } = await supabase
        .from("assignments")
        .select("id, title, due_at, type, classrooms(name, subject)")
        .in("classroom_id", classroomIds)
        .eq("status", "published")
        .order("due_at", { ascending: true });

      if (assignError) throw assignError;

      setAssignments((assignmentsData as Assignment[]) || []);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (propAssignments !== undefined && propClassrooms !== undefined) {
      setAssignments(propAssignments);
      setClassrooms(propClassrooms);
      setLoading(propLoading ?? false);
    } else {
      fetchData();
    }
  }, [studentId, propAssignments, propClassrooms, propLoading, fetchData]);

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
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading calendar...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Assignment Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          month={month}
          onMonthChange={setMonth}
          modifiers={modifiers}
          modifiersStyles={CALENDAR_MODIFIERS_STYLES}
          className="rounded-md border"
        />

        {selectedDate && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">{format(selectedDate, "MMMM d, yyyy")}</h3>

            {activeClassesForSelectedDate.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Active Classes ({activeClassesForSelectedDate.length})
                </h4>
                <div className="space-y-1">
                  {activeClassesForSelectedDate.map((classroom) => (
                    <div
                      key={classroom.id}
                      className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
                    >
                      <p className="font-medium text-xs">{classroom.name}</p>
                      <p className="text-[10px] text-muted-foreground">{classroom.subject}</p>
                      {classroom.start_date && classroom.end_date && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(classroom.start_date), "MMM d")} -{" "}
                          {format(new Date(classroom.end_date), "MMM d")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-red-600 dark:text-red-400">Assignments Due</h4>
              {assignmentsForSelectedDate.length === 0 ? (
                <p className="text-xs text-muted-foreground">No assignments due on this date</p>
              ) : (
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {assignmentsForSelectedDate.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                      >
                        <p className="font-medium text-sm">{assignment.title}</p>
                        <p className="text-xs text-muted-foreground">{assignment.classrooms.name}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {assignment.type.replace("_", " ")}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {assignment.classrooms.subject}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        {assignments.length > 0 && (
          <div className="pt-4 border-t">
            <h3 className="font-semibold text-sm mb-2">Upcoming Assignments ({assignments.length})</h3>
            <ScrollArea className="h-[150px]">
              <div className="space-y-1">
                {assignments.slice(0, 10).map((assignment) => (
                  <div key={assignment.id} className="flex justify-between items-center text-xs py-1">
                    <span className="truncate flex-1">{assignment.title}</span>
                    <span className="text-muted-foreground ml-2 whitespace-nowrap">
                      {format(new Date(assignment.due_at), "MMM d")}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
