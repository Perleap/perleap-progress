import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Lightbulb, AlertTriangle, TrendingDown, Clock } from 'lucide-react';
import type { NuanceRecommendation } from '@/hooks/queries/useNuanceQueries';

interface StudentInsightCardProps {
  recommendation: NuanceRecommendation;
}

const typeConfig: Record<string, { icon: typeof Lightbulb }> = {
  engagement_support: { icon: AlertTriangle },
  pacing_support: { icon: Clock },
  persistence_support: { icon: TrendingDown },
};

function getConfidenceLabel(score: number): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  if (score >= 0.75) return { label: 'High', variant: 'default' };
  if (score >= 0.5) return { label: 'Medium', variant: 'secondary' };
  return { label: 'Low', variant: 'outline' };
}

function formatMetricValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (isNaN(num)) return String(value);

  if (key.includes('ratio') || key.includes('rate')) return `${(num * 100).toFixed(0)}%`;
  if (key.includes('latency') || key.includes('_ms')) {
    if (num > 60000) return `${(num / 60000).toFixed(1)}m`;
    return `${(num / 1000).toFixed(1)}s`;
  }
  return num.toFixed(1);
}

export function StudentInsightCard({ recommendation }: StudentInsightCardProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const dir = isRTL ? 'rtl' : 'ltr';

  const { icon: Icon } = typeConfig[recommendation.recommendation_type] || typeConfig.engagement_support;
  const confidence = getConfidenceLabel(recommendation.confidence_score);
  const metrics = recommendation.supporting_metrics || {};

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border" dir={dir}>
      {/* Recommendation */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t(`nuance.types.${recommendation.recommendation_type}`, recommendation.recommendation_type.replace(/_/g, ' '))}
            </span>
            <Badge variant={confidence.variant} className="text-[10px] px-2 py-0 h-5 rounded-full">
              {t(`nuance.confidence.${confidence.label.toLowerCase()}`, confidence.label)}
            </Badge>
          </div>
          <p className={`text-sm font-medium text-foreground leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
            {recommendation.recommendation_text}
          </p>
        </div>
      </div>

      {/* Trigger Reason */}
      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
          <Lightbulb className="h-3 w-3" />
          {t('nuance.whyTriggered', 'Why this was triggered')}
        </p>
        <p className={`text-xs text-muted-foreground leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
          {recommendation.trigger_reason}
        </p>
      </div>

      {/* Supporting Metrics */}
      {Object.keys(metrics).length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            {t('nuance.supportingData', 'Supporting data')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(metrics).map(([key, value]) => (
              <div key={key} className="bg-card rounded-lg px-3 py-2 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
                  {key.replace(/_/g, ' ')}
                </p>
                <p className="text-sm font-bold text-foreground">
                  {formatMetricValue(key, value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
