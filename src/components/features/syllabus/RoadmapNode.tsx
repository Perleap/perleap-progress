import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoadmapNodeData, SectionStatus } from '@/types/syllabus';

const statusConfig: Record<SectionStatus, { labelKey: string; className: string }> = {
  upcoming: { labelKey: 'syllabus.roadmap.upcoming', className: 'bg-muted text-muted-foreground' },
  in_progress: { labelKey: 'syllabus.roadmap.inProgress', className: 'bg-primary/15 text-primary border-primary/30' },
  completed: { labelKey: 'syllabus.roadmap.completed', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

type RoadmapNodeProps = NodeProps & { data: RoadmapNodeData };

export const RoadmapNode = memo(({ data, selected }: RoadmapNodeProps) => {
  const { t } = useTranslation();
  const { title, description, startDate, endDate, assignmentCount, status } = data;
  const statusInfo = statusConfig[status];

  const dateRange = [startDate, endDate].filter(Boolean).join(' → ');

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2 !border-0" />
      <div
        className={cn(
          'bg-card border-2 rounded-xl px-5 py-4 w-[320px] transition-all shadow-sm hover:shadow-md cursor-pointer',
          selected ? 'border-primary ring-4 ring-primary/10' : 'border-border',
          status === 'in_progress' && !selected && 'border-primary/40'
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="font-bold text-foreground text-sm leading-tight flex-1">{title}</h4>
          <Badge variant="outline" className={cn('rounded-full text-[10px] px-2 py-0 flex-shrink-0', statusInfo.className)}>
            {t(statusInfo.labelKey)}
          </Badge>
        </div>

        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{description}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {dateRange && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {dateRange}
            </span>
          )}
          {assignmentCount > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {assignmentCount} {assignmentCount !== 1 ? t('syllabus.roadmap.assignments') : t('syllabus.roadmap.assignment')}
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2 !border-0" />
    </>
  );
});

RoadmapNode.displayName = 'RoadmapNode';
