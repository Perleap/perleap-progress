import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

const rowClass =
  'min-h-[48px] transition-all duration-200 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9 group-data-[collapsible=icon]:!p-1.5 group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!rounded-lg';

export function AdminAiPromptsSidebarLink() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const onAiPrompts = location.pathname.startsWith('/admin/ai-prompts');

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={t('nav.aiPrompts')}
        onClick={() => navigate('/admin/ai-prompts')}
        isActive={onAiPrompts}
        className={`${rowClass} ${onAiPrompts ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
      >
        <Sparkles className="size-5 group-data-[collapsible=icon]:size-5" />
        <span className="font-medium text-base group-data-[collapsible=icon]:hidden">{t('nav.aiPrompts')}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
