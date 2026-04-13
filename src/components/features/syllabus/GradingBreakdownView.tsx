import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { GraduationCap } from 'lucide-react';
import type { GradingCategory } from '@/types/syllabus';

interface GradingBreakdownViewProps {
  categories: GradingCategory[];
  isRTL?: boolean;
}

const COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-orange-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-amber-500',
  'bg-red-500',
];

export const GradingBreakdownView = ({ categories, isRTL = false }: GradingBreakdownViewProps) => {
  const { t } = useTranslation();

  const totalWeight = useMemo(() =>
    categories.reduce((sum, c) => sum + c.weight, 0),
    [categories]
  );

  if (categories.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className={cn(
        'text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1',
        isRTL && 'flex-row-reverse text-right'
      )}>
        <GraduationCap className="h-3 w-3" /> {t('syllabus.grading.breakdown')}
      </h4>

      <Card className="rounded-xl border-border shadow-sm">
        <CardContent className="p-4 space-y-4">
          {/* Visual bar */}
          <div className="h-4 rounded-full overflow-hidden flex bg-muted/30">
            {categories.map((cat, i) => {
              const pct = totalWeight > 0 ? (cat.weight / totalWeight) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <div
                  key={cat.id}
                  className={cn('h-full transition-all', COLORS[i % COLORS.length])}
                  style={{ width: `${pct}%` }}
                  title={`${cat.name}: ${cat.weight}%`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {categories.map((cat, i) => (
              <div
                key={cat.id}
                className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}
              >
                <div className={cn('h-3 w-3 rounded-sm flex-shrink-0', COLORS[i % COLORS.length])} />
                <div className={cn('flex-1 min-w-0', isRTL && 'text-right')}>
                  <span className="text-xs font-medium text-foreground truncate block">{cat.name}</span>
                </div>
                <span className="text-xs font-bold text-foreground tabular-nums flex-shrink-0">{cat.weight}%</span>
              </div>
            ))}
          </div>

          {/* Total */}
          {totalWeight !== 100 && (
            <p className={cn(
              'text-[10px] text-orange-600 dark:text-orange-400',
              isRTL && 'text-right'
            )}>
              {t('syllabus.grading.totalNote', { total: totalWeight })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
