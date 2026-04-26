import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNuanceUnderstandingCueEvents } from '@/hooks/queries';

function summarizeSignal(
  codes: string[] | undefined,
  t: (key: string) => string,
): string {
  if (!codes || codes.length === 0) return t('nuance.cueDetail.kind.unknown');
  if (codes.some((c) => c.includes('strong'))) return t('nuance.cueDetail.kind.strong');
  if (codes.some((c) => c.includes('weak'))) return t('nuance.cueDetail.kind.weak');
  return t('nuance.cueDetail.kind.unknown');
}

interface NuanceUnderstandingCuePanelProps {
  studentId: string;
  /** Scope matches the analytics table (one assignment or full filter). */
  assignmentScopeIds: string[];
  isExpanded: boolean;
  assignmentTitleMap: Map<string, string>;
}

export function NuanceUnderstandingCuePanel({
  studentId,
  assignmentScopeIds,
  isExpanded,
  assignmentTitleMap,
}: NuanceUnderstandingCuePanelProps) {
  const { t, i18n } = useTranslation();
  const { data: events, isLoading, isError } = useNuanceUnderstandingCueEvents(
    studentId,
    assignmentScopeIds,
    isExpanded,
  );

  if (!isExpanded) return null;

  if (isLoading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('nuance.cueDetail.loading', 'Loading…')}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="mt-3 text-xs text-destructive" role="alert">
        {t('nuance.cueDetail.error', 'Could not load details.')}
      </p>
    );
  }

  if (!events || events.length === 0) {
    return (
      <p className="mt-3 text-xs text-muted-foreground border-t border-border/60 pt-3">
        {t('nuance.cueDetail.noneInScope', 'No understanding cues recorded in this filter yet.')}
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-border/60 pt-3" dir="auto">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {t('nuance.cueDetail.title', 'Understanding cues (detail)')}
      </h4>
      <p className="text-[10px] text-muted-foreground mb-2">
        {t(
          'nuance.cueDetail.privacy',
          'We never store the message text. Times and turn index help you place the cue in the activity.',
        )}
      </p>
      <div className="overflow-x-auto rounded-md border border-border/80 bg-background/50 text-xs">
        <table className="w-full min-w-[320px] text-left">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">
                {t('nuance.cueDetail.headings.time', 'Time')}
              </th>
              <th className="px-2 py-1.5 font-medium text-muted-foreground">
                {t('nuance.cueDetail.headings.activity', 'Activity')}
              </th>
              <th className="px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">
                {t('nuance.cueDetail.headings.turn', 'Turn')}
              </th>
              <th className="px-2 py-1.5 font-medium text-muted-foreground">
                {t('nuance.cueDetail.headings.kind', 'Signal')}
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => {
              const meta = ev.metadata || {};
              const reasonCodes = Array.isArray(meta.reason_codes) ? (meta.reason_codes as string[]) : [];
              const idx = meta.message_index;
              const dt = new Date(ev.created_at);
              return (
                <tr key={ev.id} className="border-b border-border/60 last:border-0">
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground whitespace-nowrap">
                    {dt.toLocaleString(i18n.language, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-2 py-1.5 max-w-[10rem] truncate" title={assignmentTitleMap.get(ev.assignment_id)}>
                    {assignmentTitleMap.get(ev.assignment_id) || '—'}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-center">
                    {typeof idx === 'number' && Number.isFinite(idx) ? String(idx) : '—'}
                  </td>
                  <td className="px-2 py-1.5">{summarizeSignal(reasonCodes, t)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
