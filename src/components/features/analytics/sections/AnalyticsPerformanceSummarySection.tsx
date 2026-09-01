import { CheckCircle2, FileText, Sparkles, Trophy, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ClassroomAnalyticsViewModel } from '@/components/features/analytics/useClassroomAnalyticsViewModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type AnalyticsPerformanceSummarySectionProps = Pick<
  ClassroomAnalyticsViewModel,
  | 'isRTL'
  | 'studentCount'
  | 'displayActiveStudents'
  | 'displayAvgSubmissions'
  | 'displayEngagement'
  | 'classAverage'
  | 'studentsForCollapsible'
>;

export const AnalyticsPerformanceSummarySection = ({
  isRTL,
  studentCount,
  displayActiveStudents,
  displayAvgSubmissions,
  displayEngagement,
  classAverage,
  studentsForCollapsible,
}: AnalyticsPerformanceSummarySectionProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <Card
        className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden sticky top-6"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <CardHeader className="bg-transparent border-b border-border pb-6">
          <CardTitle
            className={`text-lg font-bold text-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
          >
            <div className="p-2 bg-primary/10 rounded-xl">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            {t('analytics.performanceSummary')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
              <div>
                <p
                  className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {t('analytics.activeStudents')}
                </p>
                <p
                  className={`text-2xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {displayActiveStudents}{' '}
                  <span className="text-sm text-muted-foreground font-normal">
                    / {studentCount}
                  </span>
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Users className="h-5 w-5" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
              <div>
                <p
                  className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {t('analytics.avgSubmissions')}
                </p>
                <p
                  className={`text-2xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {displayAvgSubmissions}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <FileText className="h-5 w-5" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
              <div>
                <p
                  className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {t('analytics.engagementRate')}
                </p>
                <p
                  className={`text-2xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {displayEngagement}%
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </div>

          {classAverage && studentsForCollapsible.filter((s) => s.latestScores).length > 0 && (
            <div className="pt-6 border-t border-border">
              <h4
                className={`text-sm font-bold text-foreground mb-4 flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
              >
                <Sparkles className="h-4 w-4 text-primary" />
                {t('analytics.average5D')}
              </h4>
              <div className="space-y-3">
                {Object.entries(classAverage).map(([dimension, score]) => {
                  const numeric = Number(score);
                  return (
                    <div key={dimension} className="flex items-center justify-between">
                      <span
                        className={`text-sm font-medium text-muted-foreground capitalize ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        {t(`dimensions.${dimension}.label`)}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(numeric / 10) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-foreground w-8 text-right">
                          {numeric.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
