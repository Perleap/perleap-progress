import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  FileText,
  BookOpen,
  CheckCircle2,
  Clock,
  CircleDot,
  SkipForward,
  Eye,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoadmapNodeData, SectionStatus, StudentProgressStatus } from '@/types/syllabus';

const statusConfig: Record<
  SectionStatus,
  {
    labelKey: string;
    icon: React.ElementType;
    badgeClass: string;
    borderClass: string;
    bgClass: string;
  }
> = {
  upcoming: {
    labelKey: 'syllabus.roadmap.upcoming',
    icon: Clock,
    badgeClass: 'bg-muted text-muted-foreground',
    borderClass: 'border-border',
    bgClass: 'bg-card',
  },
  in_progress: {
    labelKey: 'syllabus.roadmap.inProgress',
    icon: CircleDot,
    badgeClass: 'bg-primary/15 text-primary border-primary/30',
    borderClass: 'border-primary/50',
    bgClass: 'bg-primary/[0.02]',
  },
  completed: {
    labelKey: 'syllabus.roadmap.completed',
    icon: CheckCircle2,
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    borderClass: 'border-green-300 dark:border-green-800/50',
    bgClass: 'bg-green-50/50 dark:bg-green-950/10',
  },
  skipped: {
    labelKey: 'syllabus.roadmap.skipped',
    icon: SkipForward,
    badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    borderClass: 'border-orange-300 dark:border-orange-800/50',
    bgClass: 'bg-orange-50/50 dark:bg-orange-950/10',
  },
};

const studentProgressIcon: Record<StudentProgressStatus, React.ElementType> = {
  not_started: Clock,
  in_progress: CircleDot,
  reviewed: Eye,
  completed: CheckCircle2,
};

type RoadmapNodeProps = NodeProps & { data: RoadmapNodeData };

export const RoadmapNode = memo(({ data, selected }: RoadmapNodeProps) => {
  const { t } = useTranslation();
  const {
    title,
    description,
    startDate,
    endDate,
    assignmentCount,
    resourceCount,
    status,
    studentProgress,
    locked,
    sectionIndex,
    nodeWidth,
    enterDelayMs,
    isTodayInRange,
  } = data;
  const w = nodeWidth ?? 400;
  const idx = sectionIndex ?? 1;
  const delay = enterDelayMs ?? 0;
  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;

  const dateRange = [startDate, endDate].filter(Boolean).join(' → ');

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2.5 !h-2.5 !border-2 !border-background" />
      <div
        style={{
          width: w,
          maxWidth: '100%',
          ...(typeof window !== 'undefined' &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
          delay > 0
            ? { animationDelay: `${delay}ms` }
            : {}),
        }}
        className={cn(
          'group/road rounded-2xl px-5 py-4 transition-all shadow-sm hover:shadow-lg cursor-pointer border-2 relative overflow-hidden',
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:fill-mode-both motion-reduce:animate-none',
          locked ? 'bg-muted/60 opacity-70' : statusInfo.bgClass,
          selected
            ? 'border-primary ring-4 ring-primary/10 shadow-md'
            : locked
              ? 'border-muted-foreground/30'
              : statusInfo.borderClass
        )}
      >
        {/* Status accent bar */}
        <div
          className={cn(
            'absolute top-0 left-0 w-1.5 h-full rounded-l-2xl',
            status === 'in_progress' && 'bg-primary',
            status === 'completed' && 'bg-green-500',
            status === 'skipped' && 'bg-orange-400',
            status === 'upcoming' && 'bg-muted-foreground/20'
          )}
        />

        <div className="ps-2">
          <div className="flex items-start justify-between gap-2 mb-2">
            <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0 h-5 shrink-0 font-mono tabular-nums">
              {t('syllabus.roadmap.sectionN', { n: idx })}
            </Badge>
            {isTodayInRange && (
              <Badge className="rounded-full text-[10px] px-2 py-0 h-5 shrink-0 bg-amber-500/90 text-white border-0">
                {t('syllabus.roadmap.today')}
              </Badge>
            )}
          </div>

          {/* Top row: title + status */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              <h4 className="font-bold text-foreground text-sm leading-tight truncate">{title}</h4>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'rounded-full text-[10px] px-2 py-0.5 shrink-0 gap-1',
                locked ? 'bg-muted text-muted-foreground' : statusInfo.badgeClass
              )}
            >
              {locked ? <Lock className="h-3 w-3" /> : <StatusIcon className="h-3 w-3" />}
              {locked ? t('syllabus.sections.locked', 'Locked') : t(statusInfo.labelKey)}
            </Badge>
          </div>

          {/* Description */}
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{description}</p>
          )}

          {/* Chips */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {assignmentCount > 0 && (
              <Badge variant="outline" className="rounded-full text-[10px] gap-0.5 px-2 py-0 h-5 font-normal">
                <BookOpen className="h-3 w-3" />
                {t('syllabus.roadmap.assignmentsCount', { count: assignmentCount })}
              </Badge>
            )}
            {resourceCount > 0 && (
              <Badge variant="outline" className="rounded-full text-[10px] gap-0.5 px-2 py-0 h-5 font-normal">
                <FileText className="h-3 w-3" />
                {t('syllabus.roadmap.resourcesCount', { count: resourceCount })}
              </Badge>
            )}
          </div>

          {/* Bottom row: metadata */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0">
              {dateRange && (
                <span className="flex items-center gap-1 truncate">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span className="truncate">{dateRange}</span>
                </span>
              )}
            </div>

            {studentProgress && studentProgress !== 'not_started' && (
              <Badge
                variant="outline"
                className="rounded-full text-[10px] px-2 py-0.5 bg-primary/10 text-primary border-primary/20 gap-1 shrink-0"
              >
                {(() => {
                  const ProgressIcon = studentProgressIcon[studentProgress];
                  return <ProgressIcon className="h-3 w-3" />;
                })()}
                {t(`syllabus.progress.${studentProgress}`)}
              </Badge>
            )}
          </div>

          {!locked && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground opacity-0 group-hover/road:opacity-100 transition-opacity">
              <ChevronRight className="h-3 w-3" />
              {t('syllabus.roadmap.viewDetails')}
            </p>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2.5 !h-2.5 !border-2 !border-background" />
    </>
  );
});

RoadmapNode.displayName = 'RoadmapNode';
