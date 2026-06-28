/**
 * Class Average Chart Component
 * Display 5D chart for class average or individual student
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FiveDChart } from '@/components/FiveDChart';
import type { FiveDScores, FiveDQedMeasures } from '@/types/models';

interface ClassAverageChartProps {
  scores: FiveDScores;
  qedMeasures?: FiveDQedMeasures | null;
  title: string;
  description: string;
}

/**
 * Display class average or individual student 5D profile chart
 */
export const ClassAverageChart = ({
  scores,
  qedMeasures,
  title,
  description,
}: ClassAverageChartProps) => {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base md:text-lg text-foreground">{title}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <FiveDChart scores={scores} qedMeasures={qedMeasures} />
      </CardContent>
    </Card>
  );
};
