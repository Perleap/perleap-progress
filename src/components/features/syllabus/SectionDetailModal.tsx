import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Target,
  FileText,
  BookOpen,
  CheckCircle2,
  Clock,
  SkipForward,
  Eye,
  CircleDot,
} from 'lucide-react';
import { ResourceViewer } from './ResourceViewer';
import type {
  SyllabusSection,
  SectionResource,
  SectionStatus,
  StudentProgressStatus,
  CompletionStatus,
} from '@/types/syllabus';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdateStudentProgress } from '@/hooks/queries';

interface SectionDetailModalProps {
  section: SyllabusSection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentCount: number;
  resources: SectionResource[];
  sectionStatus: SectionStatus;
  mode: 'teacher' | 'student';
  isRTL?: boolean;
  syllabusId?: string;
  studentProgress?: StudentProgressStatus;
  linkedAssignments?: Array<{ id: string; title: string; type: string; due_at: string | null }>;
}

const statusConfig: Record<SectionStatus, { labelKey: string; icon: React.ElementType; className: string }> = {
  upcoming: { labelKey: 'syllabus.roadmap.upcoming', icon: Clock, className: 'bg-muted text-muted-foreground' },
  in_progress: { labelKey: 'syllabus.roadmap.inProgress', icon: CircleDot, className: 'bg-primary/15 text-primary border-primary/30' },
  completed: { labelKey: 'syllabus.roadmap.completed', icon: CheckCircle2, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  skipped: { labelKey: 'syllabus.roadmap.skipped', icon: SkipForward, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
};

const progressOptions: { value: StudentProgressStatus; labelKey: string; icon: React.ElementType }[] = [
  { value: 'not_started', labelKey: 'syllabus.progress.notStarted', icon: Clock },
  { value: 'in_progress', labelKey: 'syllabus.progress.inProgress', icon: CircleDot },
  { value: 'reviewed', labelKey: 'syllabus.progress.reviewed', icon: Eye },
  { value: 'completed', labelKey: 'syllabus.progress.completed', icon: CheckCircle2 },
];

export const SectionDetailModal = ({
  section,
  open,
  onOpenChange,
  assignmentCount,
  resources,
  sectionStatus,
  mode,
  isRTL = false,
  syllabusId,
  studentProgress,
  linkedAssignments = [],
}: SectionDetailModalProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const updateProgress = useUpdateStudentProgress();

  if (!section) return null;

  const dateRange = [section.start_date, section.end_date].filter(Boolean).join(' → ');
  const statusInfo = statusConfig[sectionStatus];
  const StatusIcon = statusInfo.icon;

  const handleProgressChange = (newStatus: StudentProgressStatus) => {
    if (!user?.id || !syllabusId) return;
    updateProgress.mutate({
      sectionId: section.id,
      studentId: user.id,
      status: newStatus,
      syllabusId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 rounded-2xl overflow-hidden flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header with colored accent */}
        <div className={cn(
          'px-6 pt-6 pb-4 border-b border-border flex-shrink-0',
          sectionStatus === 'in_progress' && 'bg-primary/5',
          sectionStatus === 'completed' && 'bg-green-50 dark:bg-green-950/20',
        )}>
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <DialogTitle className={cn('text-xl font-bold text-foreground mb-2', isRTL && 'text-right')}>
                  {section.title}
                </DialogTitle>
                <div className={cn('flex flex-wrap items-center gap-2', isRTL && 'flex-row-reverse')}>
                  <Badge variant="outline" className={cn('rounded-full text-xs', statusInfo.className)}>
                    <StatusIcon className="h-3 w-3 me-1" />
                    {t(statusInfo.labelKey)}
                  </Badge>
                  {dateRange && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> {dateRange}
                    </span>
                  )}
                  {assignmentCount > 0 && (
                    <Badge variant="secondary" className="rounded-full text-xs">
                      <BookOpen className="h-3 w-3 me-1" /> {assignmentCount}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <ScrollArea className="flex-1 overflow-y-auto max-h-[calc(85vh-120px)]">
          <div className="px-6 py-5 space-y-6">
            {/* Student progress tracker */}
            {mode === 'student' && syllabusId && (
              <div className="space-y-2">
                <h4 className={cn(
                  'text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1',
                  isRTL && 'flex-row-reverse'
                )}>
                  <CheckCircle2 className="h-3 w-3" /> {t('syllabus.progress.myProgress')}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {progressOptions.map((opt) => {
                    const OptIcon = opt.icon;
                    const isActive = studentProgress === opt.value;
                    return (
                      <Button
                        key={opt.value}
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleProgressChange(opt.value)}
                        disabled={updateProgress.isPending}
                        className={cn(
                          'rounded-full gap-1.5 text-xs h-8',
                          isActive && 'shadow-sm'
                        )}
                      >
                        <OptIcon className="h-3 w-3" />
                        {t(opt.labelKey)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            {section.description && (
              <div>
                <h4 className={cn(
                  'text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2',
                  isRTL && 'text-right'
                )}>
                  {t('syllabus.detail.description')}
                </h4>
                <p className={cn(
                  'text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap bg-muted/20 p-4 rounded-xl',
                  isRTL && 'text-right'
                )}>
                  {section.description}
                </p>
              </div>
            )}

            {/* Objectives */}
            {section.objectives && section.objectives.length > 0 && (
              <div>
                <h4 className={cn(
                  'text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1',
                  isRTL && 'flex-row-reverse'
                )}>
                  <Target className="h-3 w-3" /> {t('syllabus.detail.objectives')}
                </h4>
                <div className="space-y-2">
                  {section.objectives.map((obj, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/20',
                        isRTL && 'flex-row-reverse text-right'
                      )}
                    >
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                      </div>
                      <span className="text-sm text-foreground/80">{obj}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resources */}
            {resources.length > 0 && (
              <ResourceViewer resources={resources} isRTL={isRTL} />
            )}

            {/* Linked assignments */}
            {linkedAssignments.length > 0 && (
              <div>
                <h4 className={cn(
                  'text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1',
                  isRTL && 'flex-row-reverse'
                )}>
                  <BookOpen className="h-3 w-3" /> {t('syllabus.detail.linkedAssignments')}
                </h4>
                <div className="space-y-1.5">
                  {linkedAssignments.map((a) => (
                    <div
                      key={a.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card/50',
                        isRTL && 'flex-row-reverse'
                      )}
                    >
                      <div className="p-1.5 rounded-md bg-muted/50">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <span className="text-sm font-medium text-foreground truncate block">{a.title}</span>
                        <span className="text-[10px] text-muted-foreground">{a.type}</span>
                      </div>
                      {a.due_at && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 flex-shrink-0">
                          <Calendar className="h-3 w-3" />
                          {new Date(a.due_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
