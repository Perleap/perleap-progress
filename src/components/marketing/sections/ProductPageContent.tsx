import { Sparkles, Zap, Shield, BarChart3, Brain, Cpu, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MarketingCta, MarketingHero } from '@/components/marketing';
import { Button } from '@/components/ui/button';

export const ProductPageContent = () => {
  const { t } = useTranslation();

  const features = [
    {
      icon: Brain,
      titleKey: 'product.features.cognitive.title',
      descriptionKey: 'product.features.cognitive.description',
    },
    {
      icon: Zap,
      titleKey: 'product.features.grading.title',
      descriptionKey: 'product.features.grading.description',
    },
    {
      icon: BarChart3,
      titleKey: 'product.features.analytics.title',
      descriptionKey: 'product.features.analytics.description',
    },
    {
      icon: Shield,
      titleKey: 'product.features.secure.title',
      descriptionKey: 'product.features.secure.description',
    },
    {
      icon: Cpu,
      titleKey: 'product.features.adaptive.title',
      descriptionKey: 'product.features.adaptive.description',
    },
    {
      icon: Sparkles,
      titleKey: 'product.features.softSkills.title',
      descriptionKey: 'product.features.softSkills.description',
    },
  ] as const;

  return (
    <>
      <MarketingHero
        eyebrow={
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 border border-black/5 backdrop-blur-sm mb-8 animate-fade-in shadow-sm">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-foreground/80">{t('product.badge')}</span>
          </div>
        }
        title={t('product.heroTitle1')}
        highlightedTitle={t('product.heroTitle2')}
        subtitle={t('product.heroSubtitle')}
        actions={
          <Link to="/register">
            <Button
              size="lg"
              className="bg-black text-white hover:bg-black/90 rounded-full px-8 h-12 text-base shadow-lg hover:shadow-xl transition-all"
            >
              {t('product.startTrial')}
            </Button>
          </Link>
        }
      />

      <section className="py-20 bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, delay) => (
              <FeatureCard
                key={feature.titleKey}
                icon={feature.icon}
                title={t(feature.titleKey)}
                description={t(feature.descriptionKey)}
                delay={delay}
              />
            ))}
          </div>
        </div>
      </section>

      <MarketingCta
        variant="card"
        title={t('product.ctaTitle')}
        subtitle={t('product.ctaSubtitle')}
      >
        <Link to="/register">
          <Button
            size="lg"
            className="bg-black text-white hover:bg-black/90 rounded-full px-8 h-12 text-base shadow-lg"
          >
            {t('product.ctaButton')}
          </Button>
        </Link>
      </MarketingCta>
    </>
  );
};

const FeatureCard = ({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  delay: number;
}) => (
  <div
    className="p-8 rounded-lg bg-white border border-black/5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 animate-fade-in"
    style={{ animationDelay: `${delay * 0.1}s` }}
  >
    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-6 text-purple-600">
      <Icon className="w-6 h-6" />
    </div>
    <h3 className="text-xl font-bold mb-3">{title}</h3>
    <p className="text-muted-foreground leading-relaxed">{description}</p>
  </div>
);
