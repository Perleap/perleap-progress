import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const PAGE_SIZE = 25;

type AuditRow = Database['public']['Tables']['admin_audit_log']['Row'];
type ActivityRow = Database['public']['Tables']['activity_events']['Row'];
const ACTIVITY_TYPES: Database['public']['Enums']['activity_type'][] = ['create', 'update', 'delete', 'view'];
const ENTITY_TYPES: Database['public']['Enums']['entity_type'][] = ['classroom', 'assignment', 'submission', 'student'];

export default function MonitoringLogsPage() {
  const { t } = useTranslation();
  const [showAdminAudit, setShowAdminAudit] = useState(true);
  const [showActivity, setShowActivity] = useState(true);
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [auditPage, setAuditPage] = useState(0);
  const [activityPage, setActivityPage] = useState(0);

  const auditFrom = auditPage * PAGE_SIZE;
  const auditTo = auditFrom + PAGE_SIZE - 1;
  const actFrom = activityPage * PAGE_SIZE;
  const actTo = actFrom + PAGE_SIZE - 1;

  const auditQuery = useQuery({
    queryKey: ['admin_audit_log', 'monitoring', auditPage],
    enabled: showAdminAudit,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('admin_audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(auditFrom, auditTo);
      if (error) throw error;
      return { rows: (data ?? []) as AuditRow[], count: count ?? 0 };
    },
  });

  const activityQuery = useQuery({
    queryKey: ['activity_events', 'monitoring', activityPage, activityTypeFilter, entityTypeFilter],
    enabled: showActivity,
    queryFn: async () => {
      let q = supabase
        .from('activity_events')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(actFrom, actTo);
      if (activityTypeFilter !== 'all') {
        q = q.eq('type', activityTypeFilter as Database['public']['Enums']['activity_type']);
      }
      if (entityTypeFilter !== 'all') {
        q = q.eq('entity_type', entityTypeFilter as Database['public']['Enums']['entity_type']);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as ActivityRow[], count: count ?? 0 };
    },
  });

  const auditRows = auditQuery.data?.rows ?? [];
  const auditCount = auditQuery.data?.count ?? 0;
  const actRows = activityQuery.data?.rows ?? [];
  const actCount = activityQuery.data?.count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-mono text-lg font-semibold tracking-tight">{t('monitoring.navLogs')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('monitoring.logsDescription')}</p>
      </div>

      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-sm">{t('monitoring.logsFiltersTitle')}</CardTitle>
          <CardDescription>{t('monitoring.logsFiltersDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-admin-audit"
              checked={showAdminAudit}
              onCheckedChange={(v) => setShowAdminAudit(v === true)}
            />
            <Label htmlFor="show-admin-audit" className="font-mono text-xs">
              {t('monitoring.logsSourceAdmin')}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-activity"
              checked={showActivity}
              onCheckedChange={(v) => setShowActivity(v === true)}
            />
            <Label htmlFor="show-activity" className="font-mono text-xs">
              {t('monitoring.logsSourceActivity')}
            </Label>
          </div>
          {showActivity ? (
            <>
              <div className="space-y-1">
                <Label className="font-mono text-[10px] uppercase text-muted-foreground">
                  {t('monitoring.logsActivityType')}
                </Label>
                <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
                  <SelectTrigger className="h-8 w-[140px] font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('monitoring.logsFilterAll')}</SelectItem>
                    {ACTIVITY_TYPES.map((x) => (
                      <SelectItem key={x} value={x}>
                        {x}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-[10px] uppercase text-muted-foreground">
                  {t('monitoring.logsEntityType')}
                </Label>
                <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                  <SelectTrigger className="h-8 w-[160px] font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('monitoring.logsFilterAll')}</SelectItem>
                    {ENTITY_TYPES.map((x) => (
                      <SelectItem key={x} value={x}>
                        {x}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {showAdminAudit ? (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-mono text-sm">{t('monitoring.auditTitle')}</CardTitle>
            <CardDescription>{t('monitoring.auditDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {auditQuery.isError ? (
              <p className="text-sm text-destructive">{t('common.error')}</p>
            ) : auditQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : auditRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('monitoring.auditEmpty')}</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-[180px] font-mono text-xs">{t('monitoring.colCreatedAt')}</TableHead>
                      <TableHead className="font-mono text-xs">{t('monitoring.colAction')}</TableHead>
                      <TableHead className="font-mono text-xs">{t('monitoring.colEntityType')}</TableHead>
                      <TableHead className="font-mono text-xs">{t('monitoring.colEntityId')}</TableHead>
                      <TableHead className="font-mono text-xs">{t('monitoring.colAdminUserId')}</TableHead>
                      <TableHead className="w-[100px] font-mono text-xs">{t('monitoring.colMetadata')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditRows.map((row, i) => (
                      <TableRow key={row.id} className={i % 2 === 1 ? 'bg-muted/20' : ''}>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">{row.action}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{row.entity_type ?? '—'}</TableCell>
                        <TableCell className="max-w-[140px] truncate font-mono text-xs" title={row.entity_id ?? ''}>
                          {row.entity_id ?? '—'}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate font-mono text-xs" title={row.admin_user_id}>
                          {row.admin_user_id}
                        </TableCell>
                        <TableCell>
                          {row.metadata != null &&
                          typeof row.metadata === 'object' &&
                          Object.keys(row.metadata as object).length > 0 ? (
                            <Collapsible>
                              <CollapsibleTrigger className="flex items-center gap-1 font-mono text-xs text-primary hover:underline">
                                <ChevronDown className="size-3 opacity-70" />
                                {t('monitoring.metadataToggle')}
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <pre className="mt-2 max-h-40 max-w-xs overflow-auto rounded-md border bg-muted/50 p-2 text-[10px] leading-relaxed">
                                  {JSON.stringify(row.metadata, null, 2)}
                                </pre>
                              </CollapsibleContent>
                            </Collapsible>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {auditCount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 font-mono text-xs text-muted-foreground">
                <span>
                  {t('monitoring.paginationSummary', {
                    from: auditFrom + 1,
                    to: Math.min(auditTo + 1, auditCount),
                    total: auditCount,
                  })}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs"
                    disabled={auditPage <= 0 || auditQuery.isFetching}
                    onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                  >
                    {t('monitoring.prevPage')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs"
                    disabled={auditTo + 1 >= auditCount || auditQuery.isFetching}
                    onClick={() => setAuditPage((p) => p + 1)}
                  >
                    {t('monitoring.nextPage')}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {showActivity ? (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-mono text-sm">{t('monitoring.logsActivityFeedTitle')}</CardTitle>
            <CardDescription>{t('monitoring.logsActivityFeedDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activityQuery.isError ? (
              <p className="text-sm text-destructive">{t('common.error')}</p>
            ) : activityQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : actRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('monitoring.logsActivityEmpty')}</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-[180px] font-mono text-xs">{t('monitoring.colCreatedAt')}</TableHead>
                      <TableHead className="font-mono text-xs">{t('monitoring.logsColType')}</TableHead>
                      <TableHead className="font-mono text-xs">{t('monitoring.logsEntityType')}</TableHead>
                      <TableHead className="font-mono text-xs">{t('monitoring.colEntityId')}</TableHead>
                      <TableHead className="font-mono text-xs">{t('monitoring.logsColTeacher')}</TableHead>
                      <TableHead className="font-mono text-xs">{t('monitoring.logsColTitle')}</TableHead>
                      <TableHead className="font-mono text-xs">{t('monitoring.logsColRoute')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actRows.map((row, i) => (
                      <TableRow key={row.id} className={i % 2 === 1 ? 'bg-muted/20' : ''}>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.type}</TableCell>
                        <TableCell className="font-mono text-xs">{row.entity_type}</TableCell>
                        <TableCell className="max-w-[120px] truncate font-mono text-xs">{row.entity_id}</TableCell>
                        <TableCell className="max-w-[100px] truncate font-mono text-xs">{row.teacher_id}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">{row.title}</TableCell>
                        <TableCell className="max-w-[160px] truncate font-mono text-[10px] text-muted-foreground">
                          {row.route}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {actCount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 font-mono text-xs text-muted-foreground">
                <span>
                  {t('monitoring.paginationSummary', {
                    from: actFrom + 1,
                    to: Math.min(actTo + 1, actCount),
                    total: actCount,
                  })}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs"
                    disabled={activityPage <= 0 || activityQuery.isFetching}
                    onClick={() => setActivityPage((p) => Math.max(0, p - 1))}
                  >
                    {t('monitoring.prevPage')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs"
                    disabled={actTo + 1 >= actCount || activityQuery.isFetching}
                    onClick={() => setActivityPage((p) => p + 1)}
                  >
                    {t('monitoring.nextPage')}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
