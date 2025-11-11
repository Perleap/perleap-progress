import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Check, Info, ArrowLeft } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';

// Mock data for pricing plans
const pricingPlans = {
  beginner: {
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
    highlighted: false,
  },
  pro: {
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
  },
  business: {
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
    highlighted: false,
  },
  enterprise: {
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
    highlighted: false,
  },
};

const Pricing = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedBeginnerCredits, setSelectedBeginnerCredits] = useState(
    pricingPlans.beginner.defaultCredits
  );
  const [selectedProCredits, setSelectedProCredits] = useState(pricingPlans.pro.defaultCredits);
  const [selectedBusinessCredits, setSelectedBusinessCredits] = useState(
    pricingPlans.business.defaultCredits
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container flex h-16 md:h-20 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/perleap_logo.png" alt="PerLeap" className="h-10 w-10" />
            <span className="text-lg md:text-xl font-semibold">PerLeap</span>
          </Link>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <Link to="/about">
              <Button size="sm" variant="ghost" className="font-medium hidden md:inline-flex">
                About
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="sm" variant="ghost" className="font-medium">
                Contact
              </Button>
            </Link>
            <ThemeToggle />
            <Link to="/auth">
              <Button size="sm" className="font-medium">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 pt-32 pb-16 max-w-7xl">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan for your needs. All plans include access to our core features.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Beginner Plan */}
          <Card className="bg-card border-border relative hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-foreground text-2xl">
                {pricingPlans.beginner.name}
              </CardTitle>
              <CardDescription className="text-muted-foreground pt-2">
                {pricingPlans.beginner.description}
              </CardDescription>
              <div className="pt-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-foreground">
                    ${pricingPlans.beginner.monthlyPrice}
                  </span>
                  <span className="text-muted-foreground">per month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">shared across unlimited users</p>
              </div>
              <div className="flex items-center gap-4 py-4">
                <span
                  className={`text-sm ${billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  Monthly
                </span>
                <Switch
                  checked={billingCycle === 'annual'}
                  onCheckedChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
                />
                <span
                  className={`text-sm ${billingCycle === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  Annual
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full">{pricingPlans.beginner.cta}</Button>

              <Select
                value={selectedBeginnerCredits.toString()}
                onValueChange={(value) => setSelectedBeginnerCredits(Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pricingPlans.beginner.creditOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="pt-4">
                <h4 className="text-foreground font-semibold mb-3">Included features:</h4>
                <TooltipProvider>
                  <ul className="space-y-3">
                    {pricingPlans.beginner.features.map((feature, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span>{feature.name}</span>
                        {feature.info && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{feature.info}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </li>
                    ))}
                  </ul>
                </TooltipProvider>
              </div>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card
            className={`bg-card border-border relative hover:shadow-lg transition-shadow ${pricingPlans.pro.highlighted ? 'ring-2 ring-primary shadow-xl' : ''}`}
          >
            {pricingPlans.pro.highlighted && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full">
                  Popular
                </span>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-foreground text-2xl">{pricingPlans.pro.name}</CardTitle>
              <CardDescription className="text-muted-foreground pt-2">
                {pricingPlans.pro.description}
              </CardDescription>
              <div className="pt-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-foreground">
                    ${pricingPlans.pro.monthlyPrice}
                  </span>
                  <span className="text-muted-foreground">per month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">shared across unlimited users</p>
              </div>
              <div className="flex items-center gap-4 py-4">
                <span
                  className={`text-sm ${billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  Monthly
                </span>
                <Switch
                  checked={billingCycle === 'annual'}
                  onCheckedChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
                />
                <span
                  className={`text-sm ${billingCycle === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  Annual
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full">{pricingPlans.pro.cta}</Button>

              <Select
                value={selectedProCredits.toString()}
                onValueChange={(value) => setSelectedProCredits(Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pricingPlans.pro.creditOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="pt-4">
                <h4 className="text-foreground font-semibold mb-3">
                  All features in Beginner, plus:
                </h4>
                <TooltipProvider>
                  <ul className="space-y-3">
                    {pricingPlans.pro.features.map((feature, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span>{feature.name}</span>
                        {feature.info && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{feature.info}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {feature.isNew && (
                          <span className="bg-accent text-accent-foreground text-[10px] font-semibold px-2 py-0.5 rounded">
                            New
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </TooltipProvider>
              </div>
            </CardContent>
          </Card>

          {/* Business Plan */}
          <Card className="bg-card border-border relative hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-foreground text-2xl">
                {pricingPlans.business.name}
              </CardTitle>
              <CardDescription className="text-muted-foreground pt-2">
                {pricingPlans.business.description}
              </CardDescription>
              <div className="pt-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-foreground">
                    ${pricingPlans.business.monthlyPrice}
                  </span>
                  <span className="text-muted-foreground">per month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">shared across unlimited users</p>
              </div>
              <div className="flex items-center gap-4 py-4">
                <span
                  className={`text-sm ${billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  Monthly
                </span>
                <Switch
                  checked={billingCycle === 'annual'}
                  onCheckedChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
                />
                <span
                  className={`text-sm ${billingCycle === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  Annual
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" variant="outline">
                {pricingPlans.business.cta}
              </Button>

              <Select
                value={selectedBusinessCredits.toString()}
                onValueChange={(value) => setSelectedBusinessCredits(Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pricingPlans.business.creditOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="pt-4">
                <h4 className="text-foreground font-semibold mb-3">All features in Pro, plus:</h4>
                <TooltipProvider>
                  <ul className="space-y-3">
                    {pricingPlans.business.features.map((feature, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span>{feature.name}</span>
                        {feature.info && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{feature.info}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {feature.isNew && (
                          <span className="bg-accent text-accent-foreground text-[10px] font-semibold px-2 py-0.5 rounded">
                            New
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </TooltipProvider>
              </div>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card className="bg-card border-border relative hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-foreground text-2xl">
                {pricingPlans.enterprise.name}
              </CardTitle>
              <CardDescription className="text-muted-foreground pt-2">
                {pricingPlans.enterprise.description}
              </CardDescription>
              <div className="pt-6 pb-8">
                <div className="text-4xl font-bold text-foreground">Custom</div>
              </div>
              <div className="py-8">
                <p className="text-muted-foreground">Flexible plans</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" variant="outline">
                {pricingPlans.enterprise.cta}
              </Button>

              <div className="pt-4">
                <h4 className="text-foreground font-semibold mb-3">
                  All features in Business, plus:
                </h4>
                <ul className="space-y-3">
                  {pricingPlans.enterprise.features.map((feature, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>{feature.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ or Additional Info Section */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Need help choosing a plan?{' '}
            <a href="#" className="text-primary hover:underline font-medium">
              Contact our sales team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
