import type { ReactNode } from 'react';
import { Footer } from '@/components/layouts/Footer';
import { Navbar } from '@/components/layouts/Navbar';
import { cn } from '@/lib/utils';

type MarketingPageLayoutProps = {
  children: ReactNode;
  mainClassName?: string;
};

export const MarketingPageLayout = ({ children, mainClassName }: MarketingPageLayoutProps) => {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/10">
      <Navbar />
      <main className={cn(mainClassName)}>{children}</main>
      <Footer />
    </div>
  );
};
