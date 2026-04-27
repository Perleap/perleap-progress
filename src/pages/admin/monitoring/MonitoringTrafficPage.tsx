import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useAdminVercelInsightsQuery } from './useAdminVercelInsightsQuery';
import { vercelSnapshotDeploymentCount } from './observabilityPayload';

type SnapshotRow = Database['public']['Tables']['observability_metric_snapshots']['Row'];

function bucketDeployments(deployments: Array<{ createdAt: number }>): Array<{ label: string; count: number }> {
  if (deployments.length === 0) return [];
  const sorted = [...deployments].sort((a, b) => a.createdAt - b.createdAt);
  const min = sorted[0].createdAt;
  const max = sorted[sorted.length - 1].createdAt;
  const spanMs = max - min;
  const hourBucket = spanMs < 48 * 3600 * 1000;

  const map = new Map<number, { label: string; count: number }>();

  for (const d of sorted) {
    const date = new Date(d.createdAt);
    let key: number;
    let label: string;
    if (hourBucket) {
      date.setMinutes(0, 0, 0);
      date.setSeconds(0, 0);
      key = date.getTime();
      label = date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit' });
    } else {
      date.setHours(0, 0, 0, 0);
      key = date.getTime();
      label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else map.set(key, { label, count: 1 });
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => ({ label: v.label, count: v.count }));
}

export default function MonitoringTrafficPage() {
  const { t } = useTranslation();
  const [snapRange, setSnapRange] = useState<'24h' | '7d' | '30d'>('7d');

  const vercelQuery = useAdminVercelInsightsQuery();

  const since = useMemo(() => {
    const d = new Date();
    if (snapRange === '24h') d.setHours(d.getHours() - 24);
    else if (snapRange === '7d') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 30);
    return d;
  }, [snapRange]);

  const vercelSnapshotsQuery = useQuery({
    queryKey: ['observability_metric_snapshots', 'vercel', snapRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('observability_metric_snapshots')
        .select('recorded_at, payload')
        .eq('source', 'vercel')
        .gte('recorded_at', since.toISOString())
        .order('recorded_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Pick<SnapshotRow, 'recorded_at' | 'payload'>[];
    },
  });

  const v = vercelQuery.data;

  const deploymentBuckets = useMemo(() => bucketDeployments(v?.deployments ?? []), [v?.deployments]);

  const snapChartData = useMemo(() => {
    return (vercelSnapshotsQuery.data ?? []).map((r) => ({
      label: new Date(r.recorded_at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      count: vercelSnapshotDeploymentCount(r.payload),
    }));
  }, [vercelSnapshotsQuery.data]);

  const barConfig = {
    count: { label: t('monitoring.trafficChartSeriesCount'), color: 'hsl(var(--chart-1))' },
  };
  const lineConfig = {
    count: { label: t('monitoring.trafficChartSeriesCount'), color: 'hsl(var(--chart-3))' },
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-mono text-lg font-semibold tracking-tight">{t('monitoring.navTraffic')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('monitoring.trafficDescription')}</p>
      </div>

      {vercelQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('monitoring.trafficErrorTitle')}</AlertTitle>
          <AlertDescription>
            {vercelQuery.error instanceof Error ? vercelQuery.error.message : t('common.error')}
          </AlertDescription>
        </Alert>
      ) : null}

      {!vercelQuery.isLoading && deploymentBuckets.length > 0 ? (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-mono text-sm">{t('monitoring.trafficChartDeploymentsTitle')}</CardTitle>
            <CardDescription>{t('monitoring.trafficChartDeploymentsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barConfig} className="h-[220px] w-full font-mono">
              <BarChart data={deploymentBuckets} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={32} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : !vercelQuery.isLoading && (v?.deployments?.length ?? 0) > 0 && deploymentBuckets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('monitoring.trafficChartNoData')}</p>
      ) : null}

      <Card className="border-border/60">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="font-mono text-sm">{t('monitoring.trafficChartSnapshotsTitle')}</CardTitle>
            <CardDescription>{t('monitoring.trafficChartSnapshotsDescription')}</CardDescription>
          </div>
          <Select value={snapRange} onValueChange={(val) => setSnapRange(val as typeof snapRange)}>
            <SelectTrigger className="h-9 w-[120px] font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">{t('monitoring.healthRange24h')}</SelectItem>
              <SelectItem value="7d">{t('monitoring.healthRange7d')}</SelectItem>
              <SelectItem value="30d">{t('monitoring.healthRange30d')}</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {vercelSnapshotsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : vercelSnapshotsQuery.isError ? (
            <p className="text-sm text-destructive">{t('common.error')}</p>
          ) : snapChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('monitoring.trafficChartNoData')}</p>
          ) : (
            <ChartContainer config={lineConfig} className="h-[220px] w-full font-mono">
              <LineChart data={snapChartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={28} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-mono text-sm">{t('monitoring.trafficProjectsTitle')}</CardTitle>
          <CardDescription>
            {v?.checkedAt
              ? t('monitoring.trafficLastChecked', { time: new Date(v.checkedAt).toLocaleString() })
              : t('monitoring.trafficProjectsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vercelQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : v?.message && !v.ok ? (
            <p className="text-sm text-muted-foreground">{v.message}</p>
          ) : !v?.projects?.length ? (
            <p className="text-sm text-muted-foreground">{t('monitoring.trafficNoProjects')}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-mono text-xs">{t('monitoring.trafficColName')}</TableHead>
                    <TableHead className="font-mono text-xs">{t('monitoring.trafficColId')}</TableHead>
                    <TableHead className="font-mono text-xs">{t('monitoring.trafficColFramework')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {v.projects.map((p, i) => (
                    <TableRow key={p.id} className={i % 2 === 1 ? 'bg-muted/20' : ''}>
                      <TableCell className="text-sm">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.id}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.framework ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-mono text-sm">{t('monitoring.trafficDeploymentsTitle')}</CardTitle>
          <CardDescription>{t('monitoring.trafficDeploymentsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {vercelQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : !v?.deployments?.length ? (
            <p className="text-sm text-muted-foreground">{t('monitoring.trafficNoDeployments')}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-mono text-xs">{t('monitoring.trafficColState')}</TableHead>
                    <TableHead className="font-mono text-xs">{t('monitoring.trafficColCreated')}</TableHead>
                    <TableHead className="font-mono text-xs">{t('monitoring.trafficColUid')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {v.deployments.map((d, i) => (
                    <TableRow key={d.uid} className={i % 2 === 1 ? 'bg-muted/20' : ''}>
                      <TableCell className="font-mono text-xs">{d.state}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {new Date(d.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-[10px]">{d.uid}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {v ? (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground">
            <ChevronDown className="size-3" />
            {t('monitoring.trafficRawToggle')}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md border bg-muted/50 p-3 text-[10px] leading-relaxed">
              {JSON.stringify(v, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
