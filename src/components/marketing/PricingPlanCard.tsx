import { Check, Info } from 'lucide-react';
import type { PricingPlan } from './pricingPlans';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type PricingPlanCardProps = {
  plan: PricingPlan;
  billingCycle: 'monthly' | 'annual';
  onBillingCycleChange: (cycle: 'monthly' | 'annual') => void;
  selectedCredits?: number;
  onCreditsChange?: (value: number) => void;
};

export const PricingPlanCard = ({
  plan,
  billingCycle,
  onBillingCycleChange,
  selectedCredits,
  onCreditsChange,
}: PricingPlanCardProps) => {
  const isEnterprise = plan.isCustom === true;

  return (
    <Card
      className={cn(
        'relative hover:shadow-xl transition-all hover:-translate-y-1',
        plan.highlighted
          ? 'bg-white/80 backdrop-blur-md border-purple-500/20 ring-2 ring-purple-500 shadow-xl hover:shadow-2xl'
          : 'bg-white/50 backdrop-blur-sm border-black/5'
      )}
    >
      {plan.highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="bg-black text-white text-xs font-semibold px-4 py-1 rounded-full shadow-lg">
            Popular
          </span>
        </div>
      )}

      <CardHeader>
        <CardTitle className="text-foreground text-2xl">{plan.name}</CardTitle>
        <CardDescription className="text-muted-foreground pt-2">{plan.description}</CardDescription>

        {isEnterprise ? (
          <>
            <div className="pt-6 pb-8">
              <div className="text-4xl font-bold text-foreground">Custom</div>
            </div>
            <div className="py-8">
              <p className="text-muted-foreground">Flexible plans</p>
            </div>
          </>
        ) : (
          <>
            <div className="pt-6">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-foreground">${plan.monthlyPrice}</span>
                <span className="text-muted-foreground">per month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">shared across unlimited users</p>
            </div>
            <div className="flex items-center gap-4 py-4">
              <span
                className={cn(
                  'text-sm',
                  billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                Monthly
              </span>
              <Switch
                checked={billingCycle === 'annual'}
                onCheckedChange={(checked) => onBillingCycleChange(checked ? 'annual' : 'monthly')}
              />
              <span
                className={cn(
                  'text-sm',
                  billingCycle === 'annual' ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                Annual
              </span>
            </div>
          </>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <Button
          className={cn(
            'w-full rounded-full shadow-sm',
            plan.ctaVariant === 'primary'
              ? 'bg-black text-white hover:bg-black/90 shadow-lg'
              : 'bg-white border border-black/10 text-foreground hover:bg-black/5'
          )}
        >
          {plan.cta}
        </Button>

        {!isEnterprise && plan.creditOptions && selectedCredits != null && onCreditsChange && (
          <Select
            value={selectedCredits.toString()}
            onValueChange={(value) => onCreditsChange(Number(value))}
          >
            <SelectTrigger className="w-full rounded-full bg-transparent border-black/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plan.creditOptions.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="pt-4">
          {plan.featuresHeading && (
            <h4 className="text-foreground font-semibold mb-3">{plan.featuresHeading}</h4>
          )}
          {isEnterprise ? (
            <ul className="space-y-3">
              {plan.features.map((feature) => (
                <li
                  key={feature.name}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>{feature.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <TooltipProvider>
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature.name}
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
                      <span className="bg-purple-100 text-purple-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        New
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </TooltipProvider>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
