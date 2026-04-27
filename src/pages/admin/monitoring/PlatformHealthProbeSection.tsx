import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { isAppAdminRole } from '@/utils/role';
import { supabase } from '@/integrations/supabase/client';
import type { AdminMonitoringProbeResult } from '@/types/adminMonitoringProbe';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export const PROBE_QUERY_KEY = ['admin-monitoring-probe'] as const;

export function useAdminMonitoringProbeQuery() {
  const { t } = useTranslation();
  const { user, session, loading: authLoading } = useAuth();
  const isAppAdmin = isAppAdminRole(user?.user_metadata?.role);

  return useQuery({
    queryKey: PROBE_QUERY_KEY,
    enabled: !authLoading && isAppAdmin && !!session?.access_token,
    queryFn: async (): Promise<AdminMonitoringProbeResult> => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error(t('monitoring.probeNoSession'));

      const { data, error } = await supabase.functions.invoke<AdminMonitoringProbeResult | { error?: string }>(
        'admin-monitoring-probe',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (error) {
        throw new Error(error.message || t('common.error'));
      }
      if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: string }).error === 'string') {
        throw new Error((data as { error: string }).error);
      }
      if (!isProbePayload(data)) {
        throw new Error(t('monitoring.probeInvalidResponse'));
      }
      return data;
    },
  });
}

function isProbePayload(x: unknown): x is AdminMonitoringProbeResult {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.checkedAt === 'string' &&
    typeof o.supabase === 'object' &&
    o.supabase !== null &&
    typeof (o.supabase as { ok?: unknown }).ok === 'boolean' &&
    typeof o.vercel === 'object' &&
    o.vercel !== null &&
    typeof (o.vercel as { ok?: unknown }).ok === 'boolean' &&
    typeof o.db === 'object' &&
    o.db !== null &&
    typeof (o.db as { ok?: unknown }).ok === 'boolean' &&
    typeof (o.db as { latencyMs?: unknown }).latencyMs === 'number'
  );
}

export function PlatformHealthProbeSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const probeQuery = useAdminMonitoringProbeQuery();
  const probe = probeQuery.data;

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>{t('monitoring.platformHealthTitle')}</CardTitle>
          <CardDescription>{t('monitoring.platformHealthDescription')}</CardDescription>
          {probe?.checkedAt && (
            <p className="text-xs text-muted-foreground">
              {t('monitoring.lastChecked', { time: new Date(probe.checkedAt).toLocaleString() })}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          disabled={probeQuery.isFetching}
          onClick={() => void queryClient.invalidateQueries({ queryKey: PROBE_QUERY_KEY })}
        >
          <RefreshCw className={`size-4 ${probeQuery.isFetching ? 'animate-spin' : ''}`} />
          {t('monitoring.refreshProbe')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {probeQuery.isError && (
          <Alert variant="destructive">
            <AlertTitle>{t('monitoring.probeErrorTitle')}</AlertTitle>
            <AlertDescription>
              {probeQuery.error instanceof Error ? probeQuery.error.message : t('common.error')}
            </AlertDescription>
          </Alert>
        )}
        {probeQuery.isLoading && !probeQuery.data ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
        ) : probe ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-card/50 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{t('monitoring.probeSupabaseMgmt')}</span>
                  <Badge variant={probe.supabase.ok ? 'secondary' : 'destructive'}>
                    {probe.supabase.ok ? t('monitoring.statusOk') : t('monitoring.statusError')}
                  </Badge>
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {probe.supabase.projectName ? (
                    <li>
                      {t('monitoring.probeProjectName')}: {probe.supabase.projectName}
                    </li>
                  ) : null}
                  {probe.supabase.projectRef ? (
                    <li className="font-mono">
                      {t('monitoring.probeProjectRef')}: {probe.supabase.projectRef}
                    </li>
                  ) : null}
                  {probe.supabase.region ? (
                    <li>
                      {t('monitoring.probeRegion')}: {probe.supabase.region}
                    </li>
                  ) : null}
                  {typeof probe.supabase.projectCount === 'number' ? (
                    <li>
                      {t('monitoring.probeProjectCount')}: {probe.supabase.projectCount}
                    </li>
                  ) : null}
                  {probe.supabase.message ? (
                    <li className="text-destructive">{probe.supabase.message}</li>
                  ) : null}
                </ul>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{t('monitoring.probeVercel')}</span>
                  <Badge variant={probe.vercel.ok ? 'secondary' : 'destructive'}>
                    {probe.vercel.ok ? t('monitoring.statusOk') : t('monitoring.statusError')}
                  </Badge>
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {probe.vercel.userEmail ? <li>{probe.vercel.userEmail}</li> : null}
                  {probe.vercel.username ? <li className="font-mono">@{probe.vercel.username}</li> : null}
                  {probe.vercel.message ? <li className="text-destructive">{probe.vercel.message}</li> : null}
                </ul>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{t('monitoring.probeDb')}</span>
                  <Badge variant={probe.db.ok ? 'secondary' : 'destructive'}>
                    {probe.db.ok ? t('monitoring.statusOk') : t('monitoring.statusError')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t('monitoring.probeLatency', { ms: probe.db.latencyMs })}</p>
                {probe.db.message ? <p className="mt-1 text-xs text-destructive">{probe.db.message}</p> : null}
              </div>
            </div>
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ChevronDown className="size-3" />
                {t('monitoring.probeRawToggle')}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 max-h-48 overflow-auto rounded-md border bg-muted/50 p-3 text-[10px] leading-relaxed">
                  {JSON.stringify(probe, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
