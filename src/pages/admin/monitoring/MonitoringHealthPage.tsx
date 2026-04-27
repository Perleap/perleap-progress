import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlatformHealthProbeSection } from './PlatformHealthProbeSection';
import { payloadDbLatencyMs } from './observabilityPayload';

type SnapshotRow = Database['public']['Tables']['observability_metric_snapshots']['Row'];

const SNAPSHOTS_KEY = ['observability_metric_snapshots', 'management_api'] as const;

export default function MonitoringHealthPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h');

  const since = useMemo(() => {
    const d = new Date();
    if (range === '24h') d.setHours(d.getHours() - 24);
    else if (range === '7d') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 30);
    return d;
  }, [range]);

  const snapshotsQuery = useQuery({
    queryKey: [...SNAPSHOTS_KEY, range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('observability_metric_snapshots')
        .select('*')
        .eq('source', 'management_api')
        .gte('recorded_at', since.toISOString())
        .order('recorded_at', { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as SnapshotRow[];
    },
  });

  const chartData = useMemo(() => {
    const rows = snapshotsQuery.data ?? [];
    return rows
      .map((r) => {
        const ms = payloadDbLatencyMs(r.payload);
        if (ms == null) return null;
        return {
          t: new Date(r.recorded_at).getTime(),
          label: new Date(r.recorded_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          latency: ms,
        };
      })
      .filter((x): x is { t: number; label: string; latency: number } => x != null);
  }, [snapshotsQuery.data]);

  const recordMutation = useMutation({
    mutationFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error(t('monitoring.probeNoSession'));
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string; inserted?: number }>(
        'collect-metric-snapshot',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (error) throw new Error(error.message);
      if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: string }).error === 'string') {
        throw new Error((data as { error: string }).error);
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['observability_metric_snapshots'] });
    },
  });

  const chartConfig = {
    latency: { label: t('monitoring.healthChartLatency'), color: 'hsl(var(--chart-1))' },
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-mono text-lg font-semibold tracking-tight">{t('monitoring.navHealth')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('monitoring.healthDescription')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <SelectTrigger className="h-9 w-[120px] font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">{t('monitoring.healthRange24h')}</SelectItem>
              <SelectItem value="7d">{t('monitoring.healthRange7d')}</SelectItem>
              <SelectItem value="30d">{t('monitoring.healthRange30d')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="font-mono text-xs"
            disabled={recordMutation.isPending}
            onClick={() => void recordMutation.mutateAsync()}
          >
            {t('monitoring.healthRecordSnapshot')}
          </Button>
        </div>
      </div>

      {recordMutation.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('monitoring.healthSnapshotErrorTitle')}</AlertTitle>
          <AlertDescription>
            {recordMutation.error instanceof Error ? recordMutation.error.message : t('common.error')}
          </AlertDescription>
        </Alert>
      ) : null}

      <PlatformHealthProbeSection />

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-mono text-sm">{t('monitoring.healthHistoryTitle')}</CardTitle>
          <CardDescription>{t('monitoring.healthHistoryDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {snapshotsQuery.isError ? (
            <p className="text-sm text-destructive">{t('common.error')}</p>
          ) : snapshotsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('monitoring.healthNoSnapshots')}</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[280px] w-full font-mono">
              <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis dataKey="latency" tick={{ fontSize: 10 }} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="latency"
                  stroke="var(--color-latency)"
                  fill="var(--color-latency)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
