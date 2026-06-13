import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function RouteLoadingFallback() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
    </div>
  );
}
