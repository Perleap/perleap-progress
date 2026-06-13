import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Video } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  formatWatchPosition,
  useVideoWatchAnalytics,
  type VideoEngagementSummary,
} from '@/hooks/queries/useVideoWatchQueries';

interface VideoEngagementPanelProps {
  classroomId: string;
  students: Array<{ id: string; name: string }>;
  isRTL?: boolean;
}

function VideoSummaryCard({
  item,
  studentsById,
  isRTL,
}: {
  item: VideoEngagementSummary;
  studentsById: Map<string, string>;
  isRTL?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
        <CollapsibleTrigger
          className={cn(
            'flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-muted/30 transition-colors',
            isRTL && 'flex-row-reverse text-end',
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{item.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('analytics.videoEngagement.summaryLine', {
                plays: item.totalPlays,
                viewers: item.uniqueViewers,
                finishes: item.totalCompletions,
                completion: item.avgCompletionPct,
              })}
            </p>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/60 px-2 pb-3 pt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cn(isRTL && 'text-right')}>
                    {t('analytics.videoEngagement.student')}
                  </TableHead>
                  <TableHead className={cn(isRTL && 'text-right')}>
                    {t('analytics.videoEngagement.plays')}
                  </TableHead>
                  <TableHead className={cn(isRTL && 'text-right')}>
                    {t('analytics.videoEngagement.lastStopped')}
                  </TableHead>
                  <TableHead className={cn(isRTL && 'text-right')}>
                    {t('analytics.videoEngagement.status')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.studentRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className={cn(isRTL && 'text-right')}>
                      {studentsById.get(row.student_user_id) ?? row.student_user_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className={cn(isRTL && 'text-right')}>{row.play_count}</TableCell>
                    <TableCell className={cn(isRTL && 'text-right')}>
                      {formatWatchPosition(row.last_position_seconds, row.duration_seconds)}
                    </TableCell>
                    <TableCell className={cn(isRTL && 'text-right')}>
                      <span className="text-sm text-muted-foreground">
                        {row.completion_count > 0
                          ? t('analytics.videoEngagement.finishedCount', {
                              count: row.completion_count,
                            })
                          : t('analytics.videoEngagement.inProgress')}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function VideoEngagementPanel({
  classroomId,
  students,
  isRTL = false,
}: VideoEngagementPanelProps) {
  const { t } = useTranslation();
  const { data = [], isLoading } = useVideoWatchAnalytics(classroomId);

  const studentsById = useMemo(
    () => new Map(students.map((s) => [s.id, s.name])),
    [students],
  );

  return (
    <Card
      className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <CardHeader className="border-b border-border pb-4">
        <CardTitle
          className={cn(
            'flex items-center gap-3 text-lg font-bold text-foreground',
            isRTL ? 'text-right flex-row-reverse' : 'text-left',
          )}
        >
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <Video className="h-5 w-5 text-primary" />
          </div>
          {t('analytics.videoEngagement.title')}
        </CardTitle>
        <CardDescription className={cn(isRTL && 'text-right')}>
          {t('analytics.videoEngagement.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('analytics.videoEngagement.empty')}</p>
        ) : (
          data.map((item) => (
            <VideoSummaryCard
              key={`${item.resourceId}-${item.lessonBlockId ?? 'main'}`}
              item={item}
              studentsById={studentsById}
              isRTL={isRTL}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
