import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MarketingHeroProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  highlightedTitle?: ReactNode;
  subtitle: string;
  actions?: ReactNode;
  className?: string;
  background?: 'purple-orange' | 'blue-pink' | 'none';
};

export const MarketingHero = ({
  eyebrow,
  title,
  highlightedTitle,
  subtitle,
  actions,
  className,
  background = 'purple-orange',
}: MarketingHeroProps) => {
  return (
    <section className={cn('relative py-20 overflow-hidden', className)}>
      {background !== 'none' && (
        <div className="absolute inset-0 pointer-events-none">
          {background === 'purple-orange' ? (
            <>
              <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200/50 rounded-full blur-[128px] animate-pulse" />
              <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-200/50 rounded-full blur-[128px] animate-pulse delay-1000" />
            </>
          ) : (
            <>
              <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-200/50 rounded-full blur-[128px] animate-pulse" />
              <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-pink-200/50 rounded-full blur-[128px] animate-pulse delay-1000" />
            </>
          )}
        </div>
      )}

      <div className="container mx-auto px-4 relative z-10 text-center">
        {eyebrow}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 animate-fade-in delay-100">
          {title}
          {highlightedTitle != null && (
            <>
              <br />
              <span className="text-gradient-primary">{highlightedTitle}</span>
            </>
          )}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-fade-in delay-200 leading-relaxed">
          {subtitle}
        </p>
        {actions && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in delay-300">
            {actions}
          </div>
        )}
      </div>
    </section>
  );
};

type MarketingCtaProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  variant?: 'card' | 'plain';
};

export const MarketingCta = ({
  title,
  subtitle,
  children,
  variant = 'plain',
}: MarketingCtaProps) => {
  if (variant === 'card') {
    return (
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto bg-accent rounded-xl p-12 border border-border shadow-xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">{title}</h2>
            {subtitle && <p className="text-lg text-muted-foreground mb-8">{subtitle}</p>}
            {children}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20">
      <div className="container mx-auto px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">{title}</h2>
          {subtitle && <p className="text-lg text-muted-foreground mb-8">{subtitle}</p>}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
};
