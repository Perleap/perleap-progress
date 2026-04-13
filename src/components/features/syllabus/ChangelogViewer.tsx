import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { History, Loader2 } from 'lucide-react';
import { useChangelog } from '@/hooks/queries';

interface ChangelogViewerProps {
  syllabusId: string;
  isRTL?: boolean;
}

export const ChangelogViewer = ({ syllabusId, isRTL = false }: ChangelogViewerProps) => {
  const { t } = useTranslation();
  const { data: entries = [], isLoading } = useChangelog(syllabusId);

  return (
    <Card className="rounded-xl border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className={cn('text-sm flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          <History className="h-4 w-4 text-muted-foreground" />
          {t('syllabus.changelog.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t('syllabus.changelog.noEntries')}
          </p>
        ) : (
          <div className="space-y-3">
            {(entries as any[]).map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg bg-muted/20',
                  isRTL && 'flex-row-reverse'
                )}
              >
                <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div className={cn('flex-1 min-w-0', isRTL && 'text-right')}>
                  <p className="text-sm text-foreground font-medium">{entry.change_summary}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
