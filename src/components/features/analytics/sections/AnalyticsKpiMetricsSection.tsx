import { Users, BookOpen, FileText, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ClassroomAnalyticsViewModel } from '@/components/features/analytics/useClassroomAnalyticsViewModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type AnalyticsKpiMetricsSectionProps = Pick<
  ClassroomAnalyticsViewModel,
  | 'isRTL'
  | 'studentCount'
  | 'displayAssignmentCount'
  | 'displayTotalSubmissions'
  | 'displayCompletion'
>;

export const AnalyticsKpiMetricsSection = ({
  isRTL,
  studentCount,
  displayAssignmentCount,
  displayTotalSubmissions,
  displayCompletion,
}: AnalyticsKpiMetricsSectionProps) => {
  const { t } = useTranslation();

  return (
    <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
      <Card
        className="rounded-[28px] border-none shadow-md bg-card/80 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <CardHeader className="pb-2">
          <CardTitle
            className={`text-sm font-medium text-muted-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
          >
            <div className="p-1.5 bg-primary/10 rounded-md">
              <Users className="h-3.5 w-3.5 text-primary" />
            </div>
            {t('analytics.totalStudents')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-foreground">{studentCount}</div>
        </CardContent>
      </Card>

      <Card
        className="rounded-[28px] border-none shadow-md bg-card/80 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <CardHeader className="pb-2">
          <CardTitle
            className={`text-sm font-medium text-muted-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
          >
            <div className="p-1.5 bg-primary/10 rounded-md">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
            </div>
            {t('analytics.assignments')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-foreground">{displayAssignmentCount}</div>
        </CardContent>
      </Card>

      <Card
        className="rounded-[28px] border-none shadow-md bg-card/80 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <CardHeader className="pb-2">
          <CardTitle
            className={`text-sm font-medium text-muted-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
          >
            <div className="p-1.5 bg-primary/10 rounded-md">
              <FileText className="h-3.5 w-3.5 text-primary" />
            </div>
            {t('analytics.totalSubmissions')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-foreground">{displayTotalSubmissions}</div>
        </CardContent>
      </Card>

      <Card
        className="rounded-[28px] border-none shadow-md bg-card/80 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <CardHeader className="pb-2">
          <CardTitle
            className={`text-sm font-medium text-muted-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
          >
            <div className="p-1.5 bg-primary/10 rounded-md">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            </div>
            {t('analytics.completionRate')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-foreground">{displayCompletion}%</div>
        </CardContent>
      </Card>
    </div>
  );
};
