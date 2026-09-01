export type PricingFeature = {
  name: string;
  info?: string;
  isNew?: boolean;
};

export type PricingPlan = {
  id: string;
  name: string;
  description: string;
  monthlyPrice?: number;
  isCustom?: boolean;
  features: PricingFeature[];
  creditOptions?: { label: string; value: number }[];
  defaultCredits?: number;
  cta: string;
  highlighted?: boolean;
  featuresHeading?: string;
  ctaVariant?: 'primary' | 'outline';
};

export const pricingPlans: PricingPlan[] = [
  {
    id: 'beginner',
    name: 'Beginner',
    description: 'Perfect for individuals and small projects getting started.',
    monthlyPrice: 20,
    features: [
      { name: '50 monthly credits', info: 'Credits for AI-powered features' },
      { name: 'Basic analytics' },
      { name: 'Community support' },
      { name: '1 project' },
      { name: 'Standard features' },
      { name: 'Email support' },
    ],
    creditOptions: [
      { label: '50 credits / month', value: 50 },
      { label: '100 credits / month', value: 100 },
      { label: '150 credits / month', value: 150 },
    ],
    defaultCredits: 50,
    cta: 'Get Started',
    featuresHeading: 'Included features:',
    ctaVariant: 'outline',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Designed for fast-moving teams building together in real time.',
    monthlyPrice: 50,
    features: [
      { name: '200 monthly credits', info: 'Credits for AI-powered features' },
      { name: '5 daily credits (up to 150/month)', info: 'Additional daily credit allocation' },
      { name: 'Usage-based Cloud + AI', info: 'Pay only for what you use', isNew: true },
      { name: 'Credit rollovers', info: 'Unused credits carry over to next month' },
      { name: 'Unlimited lovable.app domains' },
      { name: 'Advanced analytics' },
      { name: 'Priority support' },
      { name: 'Custom integrations' },
    ],
    creditOptions: [
      { label: '200 credits / month', value: 200 },
      { label: '500 credits / month', value: 500 },
      { label: '1000 credits / month', value: 1000 },
    ],
    defaultCredits: 200,
    cta: 'Upgrade to Pro',
    highlighted: true,
    featuresHeading: 'All features in Beginner, plus:',
    ctaVariant: 'primary',
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Advanced controls and power features for growing departments',
    monthlyPrice: 50,
    features: [
      { name: '100 monthly credits', info: 'Credits for AI-powered features' },
      { name: 'Internal publish', info: 'Publish to internal company networks', isNew: true },
      { name: 'SSO', info: 'Single Sign-On integration' },
      { name: 'Personal Projects' },
      { name: 'Opt out of data training' },
      { name: 'Advanced permissions' },
      { name: 'Team collaboration tools' },
      { name: 'Custom branding' },
    ],
    creditOptions: [
      { label: '100 credits / month', value: 100 },
      { label: '300 credits / month', value: 300 },
      { label: '600 credits / month', value: 600 },
    ],
    defaultCredits: 100,
    cta: 'Upgrade to Business',
    featuresHeading: 'All features in Pro, plus:',
    ctaVariant: 'outline',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Built for large orgs needing flexibility, scale, and governance.',
    isCustom: true,
    features: [
      { name: 'Dedicated support' },
      { name: 'Onboarding services' },
      { name: 'Custom connections' },
      { name: 'Group-based access control' },
      { name: 'Custom design systems' },
      { name: 'Advanced security' },
      { name: 'SLA guarantees' },
      { name: 'Volume discounts' },
    ],
    cta: 'Book a demo',
    featuresHeading: 'All features in Business, plus:',
    ctaVariant: 'outline',
  },
];
