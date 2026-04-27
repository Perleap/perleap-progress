import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Line, LineChart } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PlatformHealthProbeSection, useAdminMonitoringProbeQuery } from './PlatformHealthProbeSection';
import { useAdminVercelInsightsQuery } from './useAdminVercelInsightsQuery';
import { payloadDbLatencyMs } from './observabilityPayload';

type SnapshotRow = Database['public']['Tables']['observability_metric_snapshots']['Row'];

function payloadDbOk(payload: SnapshotRow['payload']): boolean | null {
  if (!payload || typeof payload !== 'object') return null;
  const v = (payload as { dbOk?: unknown }).dbOk;
  if (typeof v === 'boolean') return v;
  return null;
}

export default function MonitoringOverviewPage() {
  const { t } = useTranslation();
  const probeQuery = useAdminMonitoringProbeQuery();
  const vercelQuery = useAdminVercelInsightsQuery({ staleTime: 120_000 });
  const probe = probeQuery.data;

  const snapshotsQuery = useQuery({
    queryKey: ['observability_metric_snapshots', 'overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('observability_metric_snapshots')
        .select('recorded_at, payload')
        .eq('source', 'management_api')
        .order('recorded_at', { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []) as Pick<SnapshotRow, 'recorded_at' | 'payload'>[];
    },
  });

  const sparkData = useMemo(() => {
    const rows = [...(snapshotsQuery.data ?? [])].reverse();
    return rows
      .map((r) => {
        const ms = payloadDbLatencyMs(r.payload);
        if (ms == null) return null;
        return {
          label: new Date(r.recorded_at).toLocaleString(undefined, {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          latency: ms,
        };
      })
      .filter((x): x is { label: string; latency: number } => x != null);
  }, [snapshotsQuery.data]);

  const latestSnapshot = snapshotsQuery.data?.[0];
  const latestMs = latestSnapshot ? payloadDbLatencyMs(latestSnapshot.payload) : null;
  const latestOk = latestSnapshot ? payloadDbOk(latestSnapshot.payload) : null;

  const deployments7d = useMemo(() => {
    const deps = vercelQuery.data?.deployments ?? [];
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    return deps.filter((d) => d.createdAt >= cutoff).length;
  }, [vercelQuery.data]);

  const sparkConfig = {
    latency: { label: t('monitoring.healthChartLatency'), color: 'hsl(var(--chart-2))' },
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('monitoring.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('monitoring.subtitle')}</p>
      </div>

      <p className="rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {t('monitoring.externalMetricsNote')}
      </p>

      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">{t('monitoring.overviewAtAGlance')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('monitoring.overviewStatLiveDbTitle')}</CardTitle>
              <CardDescription className="text-xs">{t('monitoring.overviewStatLiveDbHint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {probeQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
              ) : probe ? (
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-2xl font-semibold tabular-nums">{probe.db.latencyMs}</span>
                    <span className="text-xs text-muted-foreground">ms</span>
                  </div>
                  <Badge variant={probe.db.ok ? 'secondary' : 'destructive'}>
                    {probe.db.ok ? t('monitoring.statusOk') : t('monitoring.statusError')}
                  </Badge>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('monitoring.overviewStatSnapshotTitle')}</CardTitle>
              <CardDescription className="text-xs">{t('monitoring.overviewStatSnapshotHint')}</CardDescription>
            </CardHeader>
            <CardContent>
              {snapshotsQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
              ) : latestMs != null ? (
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-2xl font-semibold tabular-nums">{latestMs}</span>
                    <span className="text-xs text-muted-foreground">ms</span>
                  </div>
                  {latestOk != null ? (
                    <Badge variant={latestOk ? 'secondary' : 'destructive'}>
                      {latestOk ? t('monitoring.statusOk') : t('monitoring.statusError')}
                    </Badge>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('monitoring.overviewStatDeploymentsTitle')}</CardTitle>
              <CardDescription className="text-xs">{t('monitoring.overviewStatDeploymentsHint')}</CardDescription>
            </CardHeader>
            <CardContent>
              {vercelQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
              ) : vercelQuery.isError ? (
                <p className="text-xs text-muted-foreground">—</p>
              ) : (
                <span className="font-mono text-2xl font-semibold tabular-nums">{deployments7d}</span>
              )}
            </CardContent>
          </Card>
        </div>

        {sparkData.length > 1 ? (
          <Card className="mt-4 border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('monitoring.healthHistoryTitle')}</CardTitle>
              <CardDescription className="text-xs">{t('monitoring.healthHistoryDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={sparkConfig} className="h-[100px] w-full font-mono">
                <LineChart data={sparkData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="latency"
                    stroke="var(--color-latency)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <PlatformHealthProbeSection />
    </div>
  );
}
