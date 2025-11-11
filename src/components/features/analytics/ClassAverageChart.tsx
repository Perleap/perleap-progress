/**
 * Class Average Chart Component
 * Display 5D chart for class average or individual student
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FiveDChart } from '@/components/FiveDChart';
import type { FiveDScores } from '@/types';

interface ClassAverageChartProps {
  scores: FiveDScores;
  title: string;
  description: string;
}

/**
 * Display class average or individual student 5D profile chart
 */
export const ClassAverageChart = ({ scores, title, description }: ClassAverageChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base md:text-lg">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <FiveDChart scores={scores} />
      </CardContent>
    </Card>
  );
};
