import { addDays } from 'date-fns/addDays';
import { format } from 'date-fns/format';
import { startOfDay } from 'date-fns/startOfDay';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Views, type View } from 'react-big-calendar';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PlannerAssignmentDetailSheet } from './PlannerAssignmentDetailSheet';
import { PlannerCalendarPanel } from './PlannerCalendarPanel';
import { PlannerClassroomFilterSection } from './PlannerClassroomFilterSection';
import type { PlannerCalendarEvent } from './plannerTypes';
import {
  CreateAssignmentDialog,
  EditAssignmentDialog,
} from '@/components/features/assignment/dialogs';
import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { USER_ROLES } from '@/config/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import { deleteAssignment } from '@/services/assignmentService';
import {
  fetchPlannerAssignments,
  fetchPlannerClassrooms,
  type PlannerClassroom,
} from '@/services/plannerService';

export const PlannerContent = () => {
  const { user } = useAuth();
  const isAppAdmin = user?.user_metadata?.role === USER_ROLES.ADMIN;
  const { t } = useTranslation();
  const { language = 'en', isRTL } = useLanguage();
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<PlannerClassroom[]>([]);
  const [selectedClassrooms, setSelectedClassrooms] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<PlannerCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [classroomSearch, setClassroomSearch] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [isClassSelectOpen, setIsClassSelectOpen] = useState(false);
  const [selectedClassForCreate, setSelectedClassForCreate] = useState<string>('');
  const [createDate, setCreateDate] = useState<Date | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<PlannerCalendarEvent | null>(null);
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

  const loadClassrooms = useCallback(async () => {
    if (!user?.id) return;

    try {
      const data = await fetchPlannerClassrooms(user.id, isAppAdmin);
      setClassrooms(data);
      setSelectedClassrooms(new Set(data.map((c) => c.id)));
      if (data.length === 0) {
        setEvents([]);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching classrooms:', error);
    }
  }, [user?.id, isAppAdmin]);

  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const classroomIds = classrooms.map((c) => c.id);
      const data = await fetchPlannerAssignments(classroomIds);

      const mappedEvents: PlannerCalendarEvent[] = data
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
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  }, [classrooms]);

  useEffect(() => {
    if (user?.id) {
      void loadClassrooms();
    }
  }, [user?.id, loadClassrooms]);

  useEffect(() => {
    if (user?.id && classrooms.length > 0) {
      void loadAssignments();
    }
  }, [user?.id, classrooms, loadAssignments]);

  const openCreateFlow = (start: Date) => {
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

  const handleSelectEvent = (event: PlannerCalendarEvent) => {
    setSelectedEvent(event);
    setIsSheetOpen(true);
  };

  const executeDeleteAssignment = async () => {
    if (!selectedEvent) return;

    try {
      const { success, error } = await deleteAssignment(selectedEvent.resource.assignmentId);
      if (error || !success) {
        throw error ?? new Error('Delete failed');
      }

      toast.success(t('common.deleted') || 'Assignment deleted');
      setDeleteConfirmOpen(false);
      setIsSheetOpen(false);
      setSelectedEvent(null);
      void loadAssignments();
    } catch (error) {
      toast.error(t('common.error') || 'Error deleting assignment');
      console.error(error);
    }
  };

  const handleAssignmentCreated = () => {
    void loadAssignments();
    setIsCreateOpen(false);
  };

  const handleAssignmentUpdated = () => {
    void loadAssignments();
    setIsEditOpen(false);
    setIsSheetOpen(false);
    toast.success(t('editAssignment.success.saved') || 'Assignment updated');
  };

  const filteredEvents = useMemo(() => {
    return events.filter((e) => selectedClassrooms.has(e.resource.classroomId));
  }, [events, selectedClassrooms]);

  const toggleClassroom = (classroomId: string, checked: boolean) => {
    setSelectedClassrooms((prev) => {
      const next = new Set(prev);
      if (checked) next.add(classroomId);
      else next.delete(classroomId);
      return next;
    });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('nav.planner')}</h1>
            <p className="text-muted-foreground">{t('planner.subtitle')}</p>
          </div>
          <Button onClick={() => openCreateFlow(new Date())}>
            <Plus className="me-2 h-4 w-4" />
            {t('planner.newAssignment')}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6 h-full min-h-0">
          <PlannerClassroomFilterSection
            classrooms={classrooms}
            filteredClassrooms={filteredClassrooms}
            selectedClassrooms={selectedClassrooms}
            classroomSearch={classroomSearch}
            classroomColors={classroomColors}
            onSearchChange={setClassroomSearch}
            onSelectAll={() => setSelectedClassrooms(new Set(classrooms.map((c) => c.id)))}
            onClearAll={() => setSelectedClassrooms(new Set())}
            onToggleClassroom={toggleClassroom}
          />

          <PlannerCalendarPanel
            culture={culture}
            isRTL={isRTL}
            events={filteredEvents}
            loading={loading}
            view={view}
            date={date}
            classroomColors={classroomColors}
            calendarMessages={calendarMessages}
            onViewChange={setView}
            onDateChange={setDate}
            onSelectSlot={({ start }) => openCreateFlow(start)}
            onSelectEvent={handleSelectEvent}
          />
        </div>
      </div>

      <Dialog open={isClassSelectOpen} onOpenChange={setIsClassSelectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('planner.selectClassroomTitle')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>{t('planner.classroomLabel')}</Label>
            <Select
              value={selectedClassForCreate}
              onValueChange={(v: string | null) => {
                if (v == null) return;
                setSelectedClassForCreate(v);
              }}
            >
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

      <PlannerAssignmentDetailSheet
        open={isSheetOpen}
        deleteConfirmOpen={deleteConfirmOpen}
        selectedEvent={selectedEvent}
        classrooms={classrooms}
        classroomColors={classroomColors}
        onOpenChange={setIsSheetOpen}
        onDeleteConfirmOpenChange={setDeleteConfirmOpen}
        onEdit={() => {
          setIsEditOpen(true);
          setIsSheetOpen(false);
        }}
        onViewInClassroom={(classroomId) => navigate(`/teacher/classroom/${classroomId}`)}
        onConfirmDelete={executeDeleteAssignment}
      />
    </DashboardLayout>
  );
};
