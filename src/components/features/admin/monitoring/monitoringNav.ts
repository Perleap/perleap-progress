import { LayoutGrid, ScrollText, Activity, Globe, type LucideIcon } from 'lucide-react';

export const MONITORING_BASE = '/admin/monitoring' as const;

export type MonitoringSubLabelKey =
  | 'monitoring.navOverview'
  | 'monitoring.navLogs'
  | 'monitoring.navHealth'
  | 'monitoring.navTraffic';

export type MonitoringSubItem = {
  pathSuffix: string;
  labelKey: MonitoringSubLabelKey;
  icon: LucideIcon;
};

export const monitoringSubItems: MonitoringSubItem[] = [
  { pathSuffix: '', labelKey: 'monitoring.navOverview', icon: LayoutGrid },
  { pathSuffix: 'logs', labelKey: 'monitoring.navLogs', icon: ScrollText },
  { pathSuffix: 'health', labelKey: 'monitoring.navHealth', icon: Activity },
  { pathSuffix: 'traffic', labelKey: 'monitoring.navTraffic', icon: Globe },
];

export function monitoringItemHref(pathSuffix: string): string {
  return pathSuffix ? `${MONITORING_BASE}/${pathSuffix}` : MONITORING_BASE;
}

export function isMonitoringOverviewPath(pathname: string): boolean {
  return pathname === MONITORING_BASE || pathname === `${MONITORING_BASE}/`;
}

export function isMonitoringSubActive(pathname: string, pathSuffix: string): boolean {
  const href = monitoringItemHref(pathSuffix);
  if (pathSuffix === '') return isMonitoringOverviewPath(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}
