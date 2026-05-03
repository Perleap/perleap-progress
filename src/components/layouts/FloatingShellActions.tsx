import { SidebarTrigger } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/contexts/LanguageContext';
import { NotificationDropdown } from '@/components/common/NotificationDropdown';
import { TeacherAssistantTrigger } from '@/components/ai/TeacherAssistant';
import { cn } from '@/lib/utils';

const floatingControlClass =
  'shadow-md border border-border/50 bg-background/95 backdrop-blur-md hover:bg-background';

interface FloatingShellActionsProps {
  userId: string | undefined;
  showTeacherAssistant?: boolean;
}

/**
 * Fixed corner controls so header chrome does not reserve layout space or clash with page content.
 * Mobile: sidebar open trigger on inline-start. Desktop/tablet: notifications (+ teacher AI) on inline-end.
 */
export function FloatingShellActions({ userId, showTeacherAssistant }: FloatingShellActionsProps) {
  const isMobile = useIsMobile();
  const { isRTL } = useLanguage();

  return (
    <>
      {isMobile ? (
        <div
          className={cn(
            'pointer-events-none fixed top-3 z-40 sm:hidden',
            isRTL ? 'end-3' : 'start-3',
          )}
        >
          <SidebarTrigger
            className={cn(
              'pointer-events-auto h-10 w-10 shrink-0 rounded-full',
              floatingControlClass,
            )}
          />
        </div>
      ) : null}

      {userId ? (
        <div
          className={cn(
            'pointer-events-none fixed top-3 z-40 flex items-center gap-2',
            isRTL ? 'start-3 flex-row-reverse' : 'end-3',
          )}
        >
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border/50 bg-background/95 p-1 shadow-md backdrop-blur-md">
            {showTeacherAssistant ? <TeacherAssistantTrigger className="h-9 w-9" /> : null}
            <NotificationDropdown userId={userId} triggerClassName="h-9 w-9 border-transparent bg-transparent shadow-none" />
          </div>
        </div>
      ) : null}
    </>
  );
}
