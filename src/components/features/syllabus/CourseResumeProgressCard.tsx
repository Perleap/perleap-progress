import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const DONUT_SIZE = 112;
const STROKE = 6;

const ProgressDonut = ({ percent }: { percent: number }) => {
  const center = DONUT_SIZE / 2;
  const r = (DONUT_SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);

  return (
    <div className="relative shrink-0" style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
      <svg
        width={DONUT_SIZE}
        height={DONUT_SIZE}
        className="block -rotate-90 text-primary"
        aria-hidden
      >
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          className="stroke-muted"
          strokeWidth={STROKE}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          className="stroke-primary"
          strokeWidth={STROKE}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums text-foreground sm:text-xl"
        aria-hidden
      >
        {percent}%
      </span>
    </div>
  );
};

export interface CourseResumeProgressCardProps {
  percent: number;
  headlinePrefix: string;
  headlineHighlight: string | null;
  buttonLabel: string;
  onContinue: () => void;
  isRTL: boolean;
  ariaLabel: string;
  /** Merged onto root Card (e.g. `max-w-none` for narrow sidebar columns). */
  className?: string;
  /** Merged onto Continue button (e.g. `w-full sm:w-full` in sidebar). */
  buttonClassName?: string;
}

export const CourseResumeProgressCard = ({
  percent,
  headlinePrefix,
  headlineHighlight,
  buttonLabel,
  onContinue,
  isRTL,
  ariaLabel,
  className,
  buttonClassName,
}: CourseResumeProgressCardProps) => {
  return (
    <Card
      role="region"
      aria-label={ariaLabel}
      className={cn(
        // Card defaults include py-6; omit vertical padding here so content isn't double-inset.
        'w-full max-w-2xl border border-border shadow-sm rounded-2xl bg-card overflow-hidden py-0',
        className,
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <CardContent className="px-5 py-3.5 sm:px-7 sm:py-4">
        <div
          className={cn(
            'flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6',
            isRTL ? 'sm:flex-row-reverse' : 'sm:flex-row'
          )}
        >
          <ProgressDonut percent={percent} />
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <p
              className={cn(
                'text-base leading-snug text-foreground sm:text-lg sm:leading-snug',
                isRTL ? 'text-right' : 'text-left'
              )}
            >
              <span className="font-normal">{headlinePrefix}</span>
              {headlineHighlight ? (
                <>
                  {' '}
                  <span className="font-bold">{headlineHighlight}</span>
                </>
              ) : null}
            </p>
            <Button
              type="button"
              size="lg"
              className={cn(
                'h-12 w-full gap-2.5 rounded-xl px-8 text-lg font-semibold sm:w-auto sm:min-w-[12rem] sm:self-start',
                buttonClassName,
                isRTL && 'flex-row-reverse',
              )}
              onClick={onContinue}
            >
              <span className="min-w-0">{buttonLabel}</span>
              <ArrowRight className={cn('size-6 shrink-0', isRTL && 'rotate-180')} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
