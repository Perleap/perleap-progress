import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MarketingPageLayout, PricingPlanCard, pricingPlans } from '@/components/marketing';

const Pricing = () => {
  const { t } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const initialCredits = useMemo(
    () =>
      Object.fromEntries(
        pricingPlans
          .filter((plan) => plan.defaultCredits != null)
          .map((plan) => [plan.id, plan.defaultCredits as number])
      ),
    []
  );
  const [selectedCredits, setSelectedCredits] = useState<Record<string, number>>(initialCredits);

  return (
    <MarketingPageLayout mainClassName="pt-20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-purple-100/50 rounded-full blur-[120px] opacity-50" />
      </div>

      <div className="container mx-auto px-4 pt-20 pb-16 max-w-7xl relative z-10">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 tracking-tight">
            {t('pricing.heroTitle1')}{' '}
            <span className="text-gradient-primary">{t('pricing.heroTitle2')}</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('pricing.heroSubtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {pricingPlans.map((plan) => (
            <PricingPlanCard
              key={plan.id}
              plan={plan}
              billingCycle={billingCycle}
              onBillingCycleChange={setBillingCycle}
              selectedCredits={selectedCredits[plan.id]}
              onCreditsChange={
                plan.creditOptions
                  ? (value) => setSelectedCredits((prev) => ({ ...prev, [plan.id]: value }))
                  : undefined
              }
            />
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            {t('pricing.salesCtaPrefix')}{' '}
            <Link to="/contact" className="text-primary hover:underline font-medium">
              {t('pricing.salesCtaLink')}
            </Link>
          </p>
        </div>
      </div>
    </MarketingPageLayout>
  );
};

export default Pricing;
