import { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay } from "date-fns";
import { CalendarDays, AlertCircle } from "lucide-react";
import { CALENDAR_MODIFIERS_STYLES } from "@/lib/calendarUtils";

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

export function TeacherCalendar({ teacherId, classrooms: propClassrooms, loading: propLoading }: TeacherCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  const [assignments, setAssignments] = useState<AssignmentWithIncomplete[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignmentsOnly = useCallback(async (classroomIds: string[]) => {
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
      const assignmentIds = assignmentsData.map(a => a.id);

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
      const allStudentIds = [...new Set(allEnrollments?.map(e => e.student_id) || [])];

      // Get all student profiles in one query
      const { data: allStudentProfiles } = await supabase
        .from('student_profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', allStudentIds);

      // Create lookup maps for fast access
      const enrollmentsByClassroom = new Map<string, string[]>();
      allEnrollments?.forEach(e => {
        if (!enrollmentsByClassroom.has(e.classroom_id)) {
          enrollmentsByClassroom.set(e.classroom_id, []);
        }
        enrollmentsByClassroom.get(e.classroom_id)!.push(e.student_id);
      });

      const submissionsByAssignment = new Map<string, string[]>();
      allSubmissions?.forEach(s => {
        if (!submissionsByAssignment.has(s.assignment_id)) {
          submissionsByAssignment.set(s.assignment_id, []);
        }
        submissionsByAssignment.get(s.assignment_id)!.push(s.student_id);
      });

      const studentProfilesMap = new Map<string, Student>();
      allStudentProfiles?.forEach(p => {
        studentProfilesMap.set(p.user_id, p as Student);
      });

      // Process assignments with all data in memory
      const assignmentsWithIncomplete = assignmentsData.map((assignment: any) => {
        const enrolledStudentIds = enrollmentsByClassroom.get(assignment.classroom_id) || [];
        const completedStudentIds = submissionsByAssignment.get(assignment.id) || [];
        const incompleteStudentIds = enrolledStudentIds.filter(id => !completedStudentIds.includes(id));

        const incompleteStudents = incompleteStudentIds
          .map(id => studentProfilesMap.get(id))
          .filter(Boolean) as Student[];

        return {
          ...assignment,
          incompleteStudents,
          totalStudents: enrolledStudentIds.length,
        };
      });

      setAssignments(assignmentsWithIncomplete);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
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
        return;
      }

      setClassrooms(classroomsData);
      await fetchAssignmentsOnly(classroomsData.map(c => c.id));
    } catch {
      setLoading(false);
    }
  }, [teacherId, fetchAssignmentsOnly]);

  useEffect(() => {
    if (propClassrooms !== undefined) {
      setClassrooms(propClassrooms);
      setLoading(propLoading ?? false);
      if (propClassrooms.length > 0) {
        fetchAssignmentsOnly(propClassrooms.map(c => c.id));
      } else {
        setAssignments([]);
        setLoading(false);
      }
    } else {
      fetchAssignments();
    }
  }, [teacherId, propClassrooms, propLoading, fetchAssignmentsOnly, fetchAssignments]);

  // Memoize assignment dates to avoid recalculating on every render
  const datesWithAssignments = useMemo(
    () => assignments.map(a => new Date(a.due_at)),
    [assignments]
  );

  // Memoize assignments for selected date
  const assignmentsForSelectedDate = useMemo(
    () => selectedDate
      ? assignments.filter(a => isSameDay(new Date(a.due_at), selectedDate))
      : [],
    [assignments, selectedDate]
  );

  // Memoize function to check if a date is within any classroom's active range
  const isDateInClassRange = useMemo(() => {
    return (date: Date) => classrooms.some(classroom => 
      isDateInRange(date, classroom.start_date, classroom.end_date)
    );
  }, [classrooms]);

  // Memoize active classes for selected date
  const activeClassesForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return classrooms.filter(classroom => 
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
            <h3 className="font-semibold text-sm">
              {format(selectedDate, 'MMMM d, yyyy')}
            </h3>
            
            {/* Active Classes */}
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
                          {format(new Date(classroom.start_date), 'MMM d')} - {format(new Date(classroom.end_date), 'MMM d')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assignments Due */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-red-600 dark:text-red-400">
                Assignments Due
              </h4>
              {assignmentsForSelectedDate.length === 0 ? (
                <p className="text-xs text-muted-foreground">No assignments due on this date</p>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                  {assignmentsForSelectedDate.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="p-3 rounded-lg border bg-card"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{assignment.title}</p>
                          <p className="text-xs text-muted-foreground">{assignment.classrooms.name}</p>
                        </div>
                        <Badge variant="outline" className="text-xs ml-2">
                          {assignment.type.replace('_', ' ')}
                        </Badge>
                      </div>

                      {/* Completion Status */}
                      <div className="flex items-center gap-2 text-xs mb-2">
                        <span className="text-muted-foreground">
                          {assignment.totalStudents - assignment.incompleteStudents.length} / {assignment.totalStudents} completed
                        </span>
                      </div>

                      {/* Incomplete Students */}
                      {assignment.incompleteStudents.length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 mb-2">
                            <AlertCircle className="h-3 w-3" />
                            <span>{assignment.incompleteStudents.length} pending</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {assignment.incompleteStudents.slice(0, 5).map((student) => (
                              <div
                                key={student.user_id}
                                className="flex items-center gap-1 bg-accent/50 rounded-full pl-1 pr-2 py-0.5"
                              >
                                <Avatar className="h-4 w-4">
                                  {student.avatar_url && (
                                    <AvatarImage src={student.avatar_url} alt={student.full_name} />
                                  )}
                                  <AvatarFallback className="text-[8px]">
                                    {student.full_name?.charAt(0) || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-[10px]">{student.full_name.split(' ')[0]}</span>
                              </div>
                            ))}
                            {assignment.incompleteStudents.length > 5 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{assignment.incompleteStudents.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        {/* Upcoming Assignments Summary */}
        {assignments.length > 0 && (
          <div className="pt-4 border-t">
            <h3 className="font-semibold text-sm mb-2">Upcoming Assignments ({assignments.length})</h3>
            <ScrollArea className="h-[150px]">
              <div className="space-y-1">
                {assignments.slice(0, 10).map((assignment) => (
                  <div key={assignment.id} className="flex justify-between items-center text-xs py-1">
                    <div className="flex-1">
                      <span className="truncate block">{assignment.title}</span>
                      {assignment.incompleteStudents.length > 0 && (
                        <span className="text-orange-600 dark:text-orange-400 text-[10px]">
                          {assignment.incompleteStudents.length} pending
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground ml-2 whitespace-nowrap">
                      {format(new Date(assignment.due_at), 'MMM d')}
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

