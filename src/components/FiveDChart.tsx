import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarChart } from './RadarChart';
import type { FiveDScores, FiveDQedMeasures } from '@/types/models';

interface FiveDChartProps {
  scores: FiveDScores;
  qedMeasures?: FiveDQedMeasures | null;
  explanations?: Partial<Record<keyof FiveDScores, string>> | null;
  showLabels?: boolean;
  height?: number;
  layerControlsLayout?: 'side' | 'stacked';
}

export const FiveDChart = ({
  scores,
  qedMeasures,
  explanations,
  showLabels = true,
  height,
  layerControlsLayout,
}: FiveDChartProps) => {
  return (
    <RadarChart
      scores={scores}
      qedMeasures={qedMeasures}
      explanations={explanations}
      showLabels={showLabels}
      height={height}
      layerControlsLayout={layerControlsLayout}
    />
  );
};

export const FiveDChartCard = ({
  scores,
  qedMeasures,
  explanations,
  title = '5D Soft Skills Profile',
}: FiveDChartProps & { title?: string }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>Track soft skills development across five key dimensions</CardDescription>
    </CardHeader>
    <CardContent>
      <FiveDChart scores={scores} qedMeasures={qedMeasures} explanations={explanations} />
    </CardContent>
  </Card>
);
