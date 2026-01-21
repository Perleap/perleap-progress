/**
 * Page Header Component
 * Reusable page header with navigation
 */

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  actions?: ReactNode;
}

/**
 * Display page header with optional back button and actions
 */
export const PageHeader = ({ title, subtitle, backTo, actions }: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="border-b">
      <div className="container flex h-14 md:h-16 items-center gap-2 md:gap-4 px-4">
        {backTo && (
          <Button variant="ghost" size="sm" onClick={() => navigate(backTo)}>
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-2xl font-bold truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
};
