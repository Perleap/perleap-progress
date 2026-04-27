import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import {
  MONITORING_BASE,
  monitoringItemHref,
  monitoringSubItems,
  isMonitoringSubActive,
} from './monitoringNav';

const subRowClass =
  'min-h-[48px] cursor-pointer transition-all duration-200 group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg pl-2 group-data-[collapsible=icon]:pl-2';

const parentRowClass =
  'min-h-[48px] transition-all duration-200 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg';

/**
 * MENU order: after Dashboard and Planner. Parent "Monitoring" row; MONITORING + four sub-links only on /admin/monitoring/*.
 */
export function MonitoringInlineNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const onMonitoring = location.pathname.startsWith(MONITORING_BASE);

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={t('nav.monitoring')}
          onClick={() => navigate(MONITORING_BASE)}
          isActive={onMonitoring}
          className={`${parentRowClass} ${onMonitoring ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
        >
          <Activity className="size-5 group-data-[collapsible=icon]:size-5" />
          <span className="font-medium text-base group-data-[collapsible=icon]:hidden">{t('nav.monitoring')}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {onMonitoring ? (
        <>
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <div className="px-2 pb-0.5 pt-1 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {t('nav.monitoring')}
            </div>
          </SidebarMenuItem>
          {monitoringSubItems.map((item) => {
            const href = monitoringItemHref(item.pathSuffix);
            const active = isMonitoringSubActive(location.pathname, item.pathSuffix);
            const label = t(item.labelKey);
            return (
              <SidebarMenuItem key={item.pathSuffix || 'overview'}>
                <SidebarMenuButton
                  tooltip={label}
                  onClick={() => navigate(href)}
                  isActive={active}
                  className={subRowClass}
                >
                  <item.icon className="size-5 group-data-[collapsible=icon]:size-5" />
                  <span className="font-medium text-base group-data-[collapsible=icon]:hidden">{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </>
      ) : null}
    </>
  );
}
