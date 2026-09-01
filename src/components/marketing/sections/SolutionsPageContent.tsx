import { ArrowRight, type LucideIcon, GraduationCap, School, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MarketingCta, MarketingHero } from '@/components/marketing';
import { Button } from '@/components/ui/button';

export const SolutionsPageContent = () => {
  const { t } = useTranslation();

  const sections = [
    {
      icon: School,
      titleKey: 'solutions.teachers.title',
      headlineKey: 'solutions.teachers.headline',
      descriptionKey: 'solutions.teachers.description',
      featureKeys: [
        'solutions.teachers.features.grading',
        'solutions.teachers.features.planning',
        'solutions.teachers.features.tracking',
      ],
      imageBg: 'bg-warning/10',
      reversed: false,
    },
    {
      icon: GraduationCap,
      titleKey: 'solutions.students.title',
      headlineKey: 'solutions.students.headline',
      descriptionKey: 'solutions.students.description',
      featureKeys: [
        'solutions.students.features.feedback',
        'solutions.students.features.practice',
        'solutions.students.features.mastery',
      ],
      imageBg: 'bg-info/10',
      reversed: true,
    },
    {
      icon: Users,
      titleKey: 'solutions.institutions.title',
      headlineKey: 'solutions.institutions.headline',
      descriptionKey: 'solutions.institutions.description',
      featureKeys: [
        'solutions.institutions.features.analytics',
        'solutions.institutions.features.alignment',
        'solutions.institutions.features.resources',
      ],
      imageBg: 'bg-success/10',
      reversed: false,
    },
  ] as const;

  return (
    <>
      <MarketingHero
        background="blue-pink"
        title={t('solutions.heroTitle1')}
        highlightedTitle={t('solutions.heroTitle2')}
        subtitle={t('solutions.heroSubtitle')}
      />

      <section className="py-10">
        <div className="container mx-auto px-4 space-y-20">
          {sections.map((section) => (
            <SolutionSection
              key={section.titleKey}
              icon={section.icon}
              title={t(section.titleKey)}
              headline={t(section.headlineKey)}
              description={t(section.descriptionKey)}
              features={section.featureKeys.map((key) => t(key))}
              imageBg={section.imageBg}
              reversed={section.reversed}
              learnMoreLabel={t('solutions.learnMore')}
              illustrationLabel={t('solutions.illustration')}
            />
          ))}
        </div>
      </section>

      <MarketingCta title={t('solutions.ctaTitle')}>
        <Link to="/register">
          <Button
            size="lg"
            className="bg-black text-white hover:bg-black/90 rounded-full px-8 h-12 text-base shadow-lg"
          >
            {t('solutions.getStarted')}
          </Button>
        </Link>
        <Link to="/contact">
          <Button
            size="lg"
            variant="outline"
            className="border-black/10 text-foreground hover:bg-black/5 rounded-full px-8 h-12 text-base"
          >
            {t('solutions.contactSales')}
          </Button>
        </Link>
      </MarketingCta>
    </>
  );
};

type SolutionSectionProps = {
  icon: LucideIcon;
  title: string;
  headline: string;
  description: string;
  features: string[];
  imageBg: string;
  reversed?: boolean;
  learnMoreLabel: string;
  illustrationLabel: string;
};

const SolutionSection = ({
  icon: Icon,
  title,
  headline,
  description,
  features,
  imageBg,
  reversed,
  learnMoreLabel,
  illustrationLabel,
}: SolutionSectionProps) => (
  <div
    className={`flex flex-col md:flex-row items-center gap-12 ${reversed ? 'md:flex-row-reverse' : ''}`}
  >
    <div className="flex-1 space-y-6">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-sm font-medium">
        <Icon className="w-4 h-4" />
        {title}
      </div>
      <h2 className="text-3xl md:text-4xl font-bold">{headline}</h2>
      <p className="text-lg text-muted-foreground leading-relaxed">{description}</p>
      <ul className="space-y-3">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-foreground/80">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            {feature}
          </li>
        ))}
      </ul>
      <Button variant="link" className="px-0 text-primary group">
        {learnMoreLabel}{' '}
        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </Button>
    </div>
    <div
      className={`flex-1 aspect-square md:aspect-video rounded-xl ${imageBg} flex items-center justify-center shadow-inner`}
    >
      <div className="w-2/3 h-2/3 bg-white/50 backdrop-blur-sm rounded-lg border border-white/20 shadow-lg flex items-center justify-center">
        <span className="text-muted-foreground/50 font-medium">{illustrationLabel}</span>
      </div>
    </div>
  </div>
);
