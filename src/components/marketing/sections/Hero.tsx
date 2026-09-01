import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MarketingHero } from '@/components/marketing';
import { Button } from '@/components/ui/button';

export const Hero = () => {
  const { t } = useTranslation();

  return (
    <MarketingHero
      className="min-h-screen flex items-center justify-center pt-20 bg-background"
      title={t('landing.hero.title1')}
      highlightedTitle={t('landing.hero.title2')}
      subtitle={t('landing.hero.subtitle')}
      actions={
        <>
          <Link to="/register">
            <Button
              size="lg"
              className="bg-black text-white hover:bg-black/90 rounded-full px-8 h-12 text-base shadow-lg hover:shadow-xl transition-all"
            >
              {t('landing.hero.getStarted')}
            </Button>
          </Link>
          <Link to="/about">
            <Button
              size="lg"
              variant="outline"
              className="border-black/10 text-foreground hover:bg-black/5 rounded-full px-8 h-12 text-base group bg-white/50 backdrop-blur-sm"
            >
              {t('landing.hero.learnMore')}
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </>
      }
    />
  );
};
