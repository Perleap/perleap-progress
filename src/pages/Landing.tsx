import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LandingPageContent, MarketingPageLayout } from '@/components/marketing';
import { useLandingAuthRedirect } from '@/hooks/useLandingAuthRedirect';

const Landing = () => {
  const { t } = useTranslation();
  const { isRedirecting, shouldRenderLanding } = useLandingAuthRedirect();

  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('common.redirecting')}</p>
        </div>
      </div>
    );
  }

  if (!shouldRenderLanding) {
    return null;
  }

  return (
    <MarketingPageLayout>
      <LandingPageContent />
    </MarketingPageLayout>
  );
};

export default Landing;
