import { useState, useEffect, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, View, Views } from 'react-big-calendar';
import { format } from 'date-fns/format';
import { parse } from 'date-fns/parse';
import { startOfWeek } from 'date-fns/startOfWeek';
import { getDay } from 'date-fns/getDay';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { DashboardLayout } from '@/components/layouts';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { EditAssignmentDialog } from '@/components/EditAssignmentDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, Users, BookOpen, Trash2, Edit, ExternalLink, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const locales = {
    'en-US': enUS,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

interface Classroom {
    id: string;
    name: string;
    color?: string; // We might want to assign colors
}

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resource: {
        assignmentId: string;
        classroomId: string; // To color code
        status: string;
        description: string;
        type: string;
    };
}

export default function Planner() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [selectedClassrooms, setSelectedClassrooms] = useState<Set<string>>(new Set());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<View>(Views.MONTH);
    const [date, setDate] = useState(new Date());

    // Assignment Creation State
    const [isClassSelectOpen, setIsClassSelectOpen] = useState(false);
    const [selectedClassForCreate, setSelectedClassForCreate] = useState<string>('');
    const [createDate, setCreateDate] = useState<Date | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Event Detail State
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    // Initialize colors for classrooms
    const classroomColors = useMemo(() => {
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
        const mapping: Record<string, string> = {};
        classrooms.forEach((c, i) => {
            mapping[c.id] = colors[i % colors.length];
        });
        return mapping;
    }, [classrooms]);

    useEffect(() => {
        if (user?.id) {
            fetchClassrooms();
        }
    }, [user?.id]);

    useEffect(() => {
        if (user?.id && classrooms.length > 0) {
            fetchAssignments();
        }
    }, [user?.id, classrooms, selectedClassrooms]); // Refetch if selection changes? Or just filter client side. Better filter client side if data is small.

    const fetchClassrooms = async () => {
        try {
            const { data, error } = await supabase
                .from('classrooms')
                .select('id, name')
                .eq('teacher_id', user?.id || '');

            if (error) throw error;

            if (data) {
                setClassrooms(data);
                // Select all by default
                setSelectedClassrooms(new Set(data.map(c => c.id)));
            }
        } catch (error) {
            console.error('Error fetching classrooms:', error);
        }
    };

    const fetchAssignments = async () => {
        try {
            setLoading(true);
            // Fetch all assignments for teacher's classrooms
            const classroomIds = classrooms.map(c => c.id);

            const { data, error } = await supabase
                .from('assignments')
                .select('id, title, due_at, classroom_id, status, instructions, type')
                .in('classroom_id', classroomIds);

            if (error) throw error;

            if (data) {
                const mappedEvents: CalendarEvent[] = data
                    .filter(a => a.due_at) // Only assignments with due dates
                    .map(a => {
                        const dueDate = new Date(a.due_at!);
                        return {
                            id: a.id,
                            title: a.title,
                            start: dueDate,
                            end: dueDate, // React Big Calendar handles 0 duration fine, or we can add 1 hour
                            resource: {
                                assignmentId: a.id,
                                classroomId: a.classroom_id,
                                status: a.status,
                                description: a.instructions,
                                type: a.type,
                            }
                        };
                    });
                setEvents(mappedEvents);
            }
        } catch (error) {
            console.error('Error fetching assignments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectSlot = ({ start }: { start: Date }) => {
        // Open class selection dialog first
        setCreateDate(start);
        // Be smart: if only one class, auto-select it
        if (classrooms.length === 1) {
            setSelectedClassForCreate(classrooms[0].id);
            setIsCreateOpen(true);
        } else {
            setIsClassSelectOpen(true);
        }
    };

    const handleClassSelectConfirm = () => {
        if (selectedClassForCreate) {
            setIsClassSelectOpen(false);
            setIsCreateOpen(true);
        }
    };

    const handleSelectEvent = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setIsSheetOpen(true);
    };

    const handleDeleteAssignment = async () => {
        if (!selectedEvent) return;

        // Confirm delete?
        if (!confirm(t('common.areYouSure') || 'Are you sure?')) return;

        try {
            const { error } = await supabase
                .from('assignments')
                .delete()
                .eq('id', selectedEvent.resource.assignmentId);

            if (error) throw error;
            toast.success(t('common.deleted') || 'Assignment deleted');
            setIsSheetOpen(false);
            fetchAssignments(); // Refresh
        } catch (error) {
            toast.error(t('common.error') || 'Error deleting assignment');
            console.error(error);
        }
    };

    const handleAssignmentCreated = () => {
        fetchAssignments();
        setIsCreateOpen(false);
    };

    const handleAssignmentUpdated = () => {
        fetchAssignments();
        setIsEditOpen(false);
        setIsSheetOpen(false);
        toast.success(t('editAssignment.success.saved') || 'Assignment updated');
    };

    const filteredEvents = useMemo(() => {
        return events.filter(e => selectedClassrooms.has(e.resource.classroomId));
    }, [events, selectedClassrooms]);

    const eventStyleGetter = (event: CalendarEvent) => {
        const backgroundColor = classroomColors[event.resource.classroomId] || '#3b82f6';
        return {
            style: {
                backgroundColor,
                borderRadius: '6px',
                opacity: 0.8,
                color: 'white',
                border: '0px',
                display: 'block'
            }
        };
    };

    return (
        <DashboardLayout breadcrumbs={[{ label: 'Planner' }]}>
            <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Planner</h1>
                        <p className="text-muted-foreground">Manage your schedule and assignments</p>
                    </div>
                    <Button onClick={() => {
                        setCreateDate(new Date());
                        if (classrooms.length === 1) {
                            setSelectedClassForCreate(classrooms[0].id);
                            setIsCreateOpen(true);
                        } else {
                            setIsClassSelectOpen(true);
                        }
                    }}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Assignment
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6 h-full min-h-0">
                    {/* Filters Sidebar */}
                    <Card className="h-full overflow-auto">
                        <CardHeader>
                            <CardTitle className="text-lg">Classrooms</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                {classrooms.map((classroom) => (
                                    <div key={classroom.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`class-${classroom.id}`}
                                            checked={selectedClassrooms.has(classroom.id)}
                                            onCheckedChange={(checked) => {
                                                const next = new Set(selectedClassrooms);
                                                if (checked) next.add(classroom.id);
                                                else next.delete(classroom.id);
                                                setSelectedClassrooms(next);
                                            }}
                                        />
                                        <Label
                                            htmlFor={`class-${classroom.id}`}
                                            className="flex items-center gap-2 cursor-pointer text-sm font-medium"
                                        >
                                            <span
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: classroomColors[classroom.id] || '#ccc' }}
                                            />
                                            <span className="truncate">{classroom.name}</span>
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Calendar */}
                    <Card className="h-full flex flex-col min-h-0 shadow-sm border-border/50">
                        <CardContent className="p-0 flex-1 h-full min-h-0">
                            <Calendar
                                localizer={localizer}
                                events={filteredEvents}
                                startAccessor="start"
                                endAccessor="end"
                                style={{ height: '100%', minHeight: '500px' }}
                                view={view}
                                onView={setView}
                                date={date}
                                onNavigate={setDate}
                                selectable={true}
                                onSelectSlot={handleSelectSlot}
                                onSelectEvent={handleSelectEvent}
                                eventPropGetter={eventStyleGetter}
                                tooltipAccessor={(e) => e.title}
                                className="rounded-md p-4"
                                views={[Views.MONTH, Views.WEEK, Views.DAY]}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Classroom Selection Dialog */}
            <Dialog open={isClassSelectOpen} onOpenChange={setIsClassSelectOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Classroom</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Classroom</Label>
                        <Select value={selectedClassForCreate} onValueChange={setSelectedClassForCreate}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {classrooms.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsClassSelectOpen(false)}>Cancel</Button>
                        <Button onClick={handleClassSelectConfirm} disabled={!selectedClassForCreate}>Continue</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Assignment Dialog */}
            {selectedClassForCreate && (
                <CreateAssignmentDialog
                    open={isCreateOpen}
                    onOpenChange={setIsCreateOpen}
                    classroomId={selectedClassForCreate}
                    onSuccess={handleAssignmentCreated}
                    initialData={createDate ? { due_at: format(createDate, "yyyy-MM-dd'T'HH:mm") } : undefined}
                />
            )}

            {/* Edit Assignment Dialog */}
            {selectedEvent && (
                <EditAssignmentDialog
                    open={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    assignment={{
                        id: selectedEvent.resource.assignmentId,
                        title: selectedEvent.title,
                        instructions: selectedEvent.resource.description,
                        type: selectedEvent.resource.type,
                        status: selectedEvent.resource.status,
                        due_at: selectedEvent.start.toISOString(),
                        classroom_id: selectedEvent.resource.classroomId,
                    }}
                    onSuccess={handleAssignmentUpdated}
                />
            )}

            {/* Event Details Sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Assignment Details</SheetTitle>
                        <SheetDescription>
                            {selectedEvent && classrooms.find(c => c.id === selectedEvent.resource.classroomId)?.name}
                        </SheetDescription>
                    </SheetHeader>

                    {selectedEvent && (
                        <div className="mt-6 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-xl font-bold">{selectedEvent.title}</h3>
                                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                        <Clock className="h-4 w-4" />
                                        <span>Due: {format(selectedEvent.start, 'PPP p')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                        <Badge variant={selectedEvent.resource.status === 'published' ? 'default' : 'secondary'}>
                                            {selectedEvent.resource.status}
                                        </Badge>
                                        <Badge variant="outline">
                                            {selectedEvent.resource.type}
                                        </Badge>
                                    </div>
                                </div>

                                {selectedEvent.resource.description && (
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Instructions</Label>
                                        <p className="text-sm border-l-2 pl-3 py-1 border-muted">{selectedEvent.resource.description}</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3 pt-4 border-t">
                                <Button
                                    className="w-full justify-start"
                                    onClick={() => {
                                        setIsEditOpen(true);
                                        // Keep sheet open or close it? If dialog is modal, sheet can stay or close.
                                        // Usually closing sheet is better if dialog is centered.
                                        setIsSheetOpen(false);
                                    }}
                                >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Assignment
                                </Button>
                                <Button
                                    className="w-full justify-start"
                                    variant="outline"
                                    onClick={() => {
                                        navigate(`/teacher/classroom/${selectedEvent.resource.classroomId}`);
                                    }}
                                >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    View in Classroom
                                </Button>
                                <Button
                                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                                    variant="ghost"
                                    onClick={handleDeleteAssignment}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Assignment
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </DashboardLayout>
    );
}
