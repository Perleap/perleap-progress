import { addDays } from 'date-fns/addDays';
import { format } from 'date-fns/format';
import { getDay } from 'date-fns/getDay';
import { enUS } from 'date-fns/locale/en-US';
import { he } from 'date-fns/locale/he';
import { parse } from 'date-fns/parse';
import { startOfDay } from 'date-fns/startOfDay';
import { startOfWeek } from 'date-fns/startOfWeek';
import { Clock, Edit, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { Calendar, dateFnsLocalizer, Views, type EventProps, type View } from 'react-big-calendar';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './planner-calendar.css';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { EditAssignmentDialog } from '@/components/EditAssignmentDialog';
import { DashboardLayout } from '@/components/layouts';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/useAuth';
import { USER_ROLES } from '@/config/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const locales = {
  'en-US': enUS,
  he,
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
  color?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: {
    assignmentId: string;
    classroomId: string;
    status: string;
    description: string;
    type: string;
    dueAtIso: string;
  };
}

function pickContrastForegroundHex(bgHex: string): string {
  const hex = bgHex.replace('#', '');
  const expand =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.length === 6
        ? hex
        : null;
  if (!expand) return '#ffffff';
  const r = parseInt(expand.slice(0, 2), 16) / 255;
  const g = parseInt(expand.slice(2, 4), 16) / 255;
  const b = parseInt(expand.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? '#0a0a0a' : '#ffffff';
}

const PlannerEvent = memo(({ event, title }: EventProps<CalendarEvent>) => {
  const display = typeof title === 'string' ? title : String(event.title ?? '');
  return (
    <Tooltip>
      <TooltipTrigger>
        <span className="block w-full max-w-full truncate text-left">{display}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm">
        <p className="break-words">{display}</p>
      </TooltipContent>
    </Tooltip>
  );
});

const Planner = () => {
  const { user } = useAuth();
  const isAppAdmin = user?.user_metadata?.role === USER_ROLES.ADMIN;
  const { t } = useTranslation();
  const { language = 'en', isRTL } = useLanguage();
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassrooms, setSelectedClassrooms] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [classroomSearch, setClassroomSearch] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [isClassSelectOpen, setIsClassSelectOpen] = useState(false);
  const [selectedClassForCreate, setSelectedClassForCreate] = useState<string>('');
  const [createDate, setCreateDate] = useState<Date | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const culture = language === 'he' ? 'he' : 'en-US';

  const classroomColors = useMemo(() => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    const mapping: Record<string, string> = {};
    classrooms.forEach((c, i) => {
      mapping[c.id] = colors[i % colors.length];
    });
    return mapping;
  }, [classrooms]);

  const filteredClassrooms = useMemo(() => {
    const q = classroomSearch.trim().toLowerCase();
    if (!q) return classrooms;
    return classrooms.filter((c) => c.name.toLowerCase().includes(q));
  }, [classrooms, classroomSearch]);

  const calendarMessages = useMemo(
    () => ({
      today: t('planner.toolbar.today'),
      previous: t('planner.toolbar.previous'),
      next: t('planner.toolbar.next'),
      month: t('planner.toolbar.month'),
      week: t('planner.toolbar.week'),
      day: t('planner.toolbar.day'),
    }),
    [t]
  );

  const calendarComponents = useMemo(() => ({ event: PlannerEvent }), []);

  const fetchClassrooms = useCallback(async () => {
    try {
      let q = supabase.from('classrooms').select('id, name').eq('active', true);
      if (!isAppAdmin) {
        q = q.eq('teacher_id', user?.id || '');
      }
      const { data, error } = await q;

      if (error) throw error;

      if (data) {
        setClassrooms(data);
        setSelectedClassrooms(new Set(data.map((c) => c.id)));
        if (data.length === 0) {
          setEvents([]);
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Error fetching classrooms:', error);
    }
  }, [user?.id, isAppAdmin]);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const classroomIds = classrooms.map((c) => c.id);

      const { data, error } = await supabase
        .from('assignments')
        .select('id, title, due_at, classroom_id, status, instructions, type')
        .in('classroom_id', classroomIds)
        .eq('active', true);

      if (error) throw error;

      if (data) {
        const mappedEvents: CalendarEvent[] = data
          .filter((a): a is typeof a & { due_at: string } => Boolean(a.due_at))
          .map((a) => {
            const dueDate = new Date(a.due_at);
            const dayStart = startOfDay(dueDate);
            return {
              id: a.id,
              title: a.title,
              allDay: true,
              start: dayStart,
              end: addDays(dayStart, 1),
              resource: {
                assignmentId: a.id,
                classroomId: a.classroom_id,
                status: a.status,
                description: a.instructions,
                type: a.type,
                dueAtIso: a.due_at,
              },
            };
          });
        setEvents(mappedEvents);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  }, [classrooms]);

  useEffect(() => {
    if (user?.id) {
      void fetchClassrooms();
    }
  }, [user?.id, fetchClassrooms]);

  useEffect(() => {
    if (user?.id && classrooms.length > 0) {
      void fetchAssignments();
    }
  }, [user?.id, classrooms, fetchAssignments]);

  const handleSelectSlot = ({ start }: { start: Date }) => {
    setCreateDate(start);
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

  const executeDeleteAssignment = async () => {
    if (!selectedEvent) return;

    try {
      const deletedAt = new Date().toISOString();
      const { error } = await supabase
        .from('assignments')
        .update({ active: false, deleted_at: deletedAt })
        .eq('id', selectedEvent.resource.assignmentId)
        .eq('active', true);

      if (error) throw error;
      toast.success(t('common.deleted') || 'Assignment deleted');
      setDeleteConfirmOpen(false);
      setIsSheetOpen(false);
      setSelectedEvent(null);
      void fetchAssignments();
    } catch (error) {
      toast.error(t('common.error') || 'Error deleting assignment');
      console.error(error);
    }
  };

  const handleAssignmentCreated = () => {
    void fetchAssignments();
    setIsCreateOpen(false);
  };

  const handleAssignmentUpdated = () => {
    void fetchAssignments();
    setIsEditOpen(false);
    setIsSheetOpen(false);
    toast.success(t('editAssignment.success.saved') || 'Assignment updated');
  };

  const filteredEvents = useMemo(() => {
    return events.filter((e) => selectedClassrooms.has(e.resource.classroomId));
  }, [events, selectedClassrooms]);

  const eventStyleGetter = (event: CalendarEvent) => {
    const backgroundColor = classroomColors[event.resource.classroomId] || '#3b82f6';
    const color = pickContrastForegroundHex(backgroundColor);
    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.92,
        color,
        border: '0px',
        display: 'block',
      },
    };
  };

  const selectAllClassrooms = () => {
    setSelectedClassrooms(new Set(classrooms.map((c) => c.id)));
  };

  const clearAllClassrooms = () => {
    setSelectedClassrooms(new Set());
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('nav.planner')}</h1>
            <p className="text-muted-foreground">{t('planner.subtitle')}</p>
          </div>
          <Button
            onClick={() => {
              setCreateDate(new Date());
              if (classrooms.length === 1) {
                setSelectedClassForCreate(classrooms[0].id);
                setIsCreateOpen(true);
              } else {
                setIsClassSelectOpen(true);
              }
            }}
          >
            <Plus className="me-2 h-4 w-4" />
            {t('planner.newAssignment')}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6 h-full min-h-0">
          <Card className="h-full overflow-auto">
            <CardHeader className="space-y-3 pb-2">
              <CardTitle className="text-lg">{t('planner.classroomsTitle')}</CardTitle>
              <Input
                type="search"
                placeholder={t('planner.searchPlaceholder')}
                value={classroomSearch}
                onChange={(e) => setClassroomSearch(e.target.value)}
                className="h-9"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={selectAllClassrooms}
                >
                  {t('planner.selectAll')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={clearAllClassrooms}
                >
                  {t('planner.clearAll')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {filteredClassrooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('planner.noClassroomsMatch')}</p>
                ) : (
                  filteredClassrooms.map((classroom) => (
                    <div key={classroom.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`class-${classroom.id}`}
                        className="size-5 shrink-0"
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
                        className="flex items-center gap-2 cursor-pointer text-sm font-medium min-w-0 flex-1"
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: classroomColors[classroom.id] || '#ccc' }}
                        />
                        <span className="truncate">{classroom.name}</span>
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="h-full flex flex-col min-h-0 shadow-sm border-border/50">
            <CardContent className="p-0 flex-1 h-full min-h-0">
              <div className="planner-rbc h-full min-h-[500px] p-4">
                <Calendar
                  localizer={localizer}
                  culture={culture}
                  rtl={isRTL}
                  messages={calendarMessages}
                  components={calendarComponents}
                  events={filteredEvents}
                  startAccessor="start"
                  endAccessor="end"
                  allDayAccessor="allDay"
                  style={{ height: '100%', minHeight: '500px' }}
                  view={view}
                  onView={setView}
                  date={date}
                  onNavigate={setDate}
                  selectable
                  popup
                  onSelectSlot={handleSelectSlot}
                  onSelectEvent={handleSelectEvent}
                  eventPropGetter={eventStyleGetter}
                  tooltipAccessor={null}
                  className="rounded-md"
                  views={[Views.MONTH, Views.WEEK, Views.DAY]}
                />
                {loading && (
                  <span className="sr-only" aria-live="polite">
                    {t('common.loading')}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isClassSelectOpen} onOpenChange={setIsClassSelectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('planner.selectClassroomTitle')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>{t('planner.classroomLabel')}</Label>
            <Select value={selectedClassForCreate} onValueChange={setSelectedClassForCreate}>
              <SelectTrigger>
                <SelectValue>
                  {selectedClassForCreate
                    ? classrooms.find((c) => c.id === selectedClassForCreate)?.name
                    : t('createAssignment.selectFromDomains')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {classrooms.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClassSelectOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleClassSelectConfirm} disabled={!selectedClassForCreate}>
              {t('planner.continue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedClassForCreate && (
        <CreateAssignmentDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          classroomId={selectedClassForCreate}
          onSuccess={handleAssignmentCreated}
          initialData={
            createDate ? { due_at: format(createDate, "yyyy-MM-dd'T'HH:mm") } : undefined
          }
        />
      )}

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
            due_at: selectedEvent.resource.dueAtIso,
            classroom_id: selectedEvent.resource.classroomId,
          }}
          onSuccess={handleAssignmentUpdated}
        />
      )}

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent
          className={cn(
            'gap-0 p-0 sm:max-w-md md:max-w-lg',
            'h-full max-h-[100dvh] overflow-hidden'
          )}
        >
          {selectedEvent && (
            <>
              <div
                className="h-1 w-full shrink-0 rounded-b-sm"
                style={{
                  backgroundColor:
                    classroomColors[selectedEvent.resource.classroomId] ?? 'hsl(var(--primary))',
                }}
                aria-hidden
              />
              <SheetHeader className="space-y-3 border-b border-border/50 bg-muted/20 p-6 text-start">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border/60"
                    style={{
                      backgroundColor:
                        classroomColors[selectedEvent.resource.classroomId] ?? 'hsl(var(--muted))',
                    }}
                  />
                  <span className="truncate font-medium">
                    {classrooms.find((c) => c.id === selectedEvent.resource.classroomId)?.name}
                  </span>
                </div>
                <SheetTitle className="text-xl font-semibold leading-snug tracking-tight pe-10">
                  {selectedEvent.title}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  {t('planner.assignmentDetails')}
                </SheetDescription>
              </SheetHeader>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
                  <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <div className="flex flex-wrap items-start gap-x-2 gap-y-1 text-sm">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="font-medium text-foreground">{t('planner.dueLabel')}</span>
                        <span className="text-muted-foreground">
                          {': '}
                          {format(new Date(selectedEvent.resource.dueAtIso), 'PPP p')}
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={
                          selectedEvent.resource.status === 'published' ? 'default' : 'secondary'
                        }
                      >
                        {selectedEvent.resource.status}
                      </Badge>
                      <Badge variant="outline">{selectedEvent.resource.type}</Badge>
                    </div>
                  </div>

                  {selectedEvent.resource.description ? (
                    <>
                      <Separator className="bg-border/60" />
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          {t('planner.instructions')}
                        </p>
                        <div className="rounded-2xl bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
                          {selectedEvent.resource.description}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>

                <SheetFooter className="mt-0 flex-col gap-0 border-t bg-background/95 p-6 backdrop-blur-sm supports-[backdrop-filter]:bg-background/85">
                  <div className="flex w-full flex-col gap-2 sm:flex-row">
                    <Button
                      className="flex-1 gap-2 sm:min-h-10"
                      onClick={() => {
                        setIsEditOpen(true);
                        setIsSheetOpen(false);
                      }}
                    >
                      <Edit className="h-4 w-4 shrink-0" />
                      {t('planner.editAssignment')}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2 sm:min-h-10"
                      onClick={() => {
                        navigate(`/teacher/classroom/${selectedEvent.resource.classroomId}`);
                      }}
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      {t('planner.viewInClassroom')}
                    </Button>
                  </div>
                  <div className="mt-4 w-full border-t border-border/60 pt-4">
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 shrink-0" />
                      {t('planner.deleteAssignment')}
                    </Button>
                  </div>
                </SheetFooter>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('planner.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('planner.deleteConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void executeDeleteAssignment()}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Planner;
