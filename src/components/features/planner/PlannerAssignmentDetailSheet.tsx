import { format } from 'date-fns/format';
import { Clock, Edit, ExternalLink, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { PlannerClassroom } from '@/services/plannerService';
import type { PlannerCalendarEvent } from './plannerTypes';

export type PlannerAssignmentDetailSheetProps = {
  open: boolean;
  deleteConfirmOpen: boolean;
  selectedEvent: PlannerCalendarEvent | null;
  classrooms: PlannerClassroom[];
  classroomColors: Record<string, string>;
  onOpenChange: (open: boolean) => void;
  onDeleteConfirmOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onViewInClassroom: (classroomId: string) => void;
  onConfirmDelete: () => void | Promise<void>;
};

export function PlannerAssignmentDetailSheet({
  open,
  deleteConfirmOpen,
  selectedEvent,
  classrooms,
  classroomColors,
  onOpenChange,
  onDeleteConfirmOpenChange,
  onEdit,
  onViewInClassroom,
  onConfirmDelete,
}: PlannerAssignmentDetailSheetProps) {
  const { t } = useTranslation();

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          className={cn(
            'gap-0 p-0 sm:max-w-md md:max-w-lg',
            'h-full max-h-[100dvh] overflow-hidden',
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
                    <Button className="flex-1 gap-2 sm:min-h-10" onClick={onEdit}>
                      <Edit className="h-4 w-4 shrink-0" />
                      {t('planner.editAssignment')}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2 sm:min-h-10"
                      onClick={() => onViewInClassroom(selectedEvent.resource.classroomId)}
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      {t('planner.viewInClassroom')}
                    </Button>
                  </div>
                  <div className="mt-4 w-full border-t border-border/60 pt-4">
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onDeleteConfirmOpenChange(true)}
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={onDeleteConfirmOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('planner.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('planner.deleteConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void onConfirmDelete()}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
