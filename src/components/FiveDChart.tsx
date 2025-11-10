import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadarChart } from "./RadarChart";
import type { FiveDScores } from "@/types/models";

interface FiveDChartProps {
  scores: FiveDScores;
  explanations?: Partial<Record<keyof FiveDScores, string>> | null;
  showLabels?: boolean;
}

export const FiveDChart = ({ scores, explanations, showLabels = true }: FiveDChartProps) => {
  return <RadarChart scores={scores} explanations={explanations} showLabels={showLabels} />;
};

export const FiveDChartCard = ({ 
  scores, 
  explanations, 
  title = "5D Soft Skills Profile" 
}: FiveDChartProps & { title?: string }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>Track soft skills development across five key dimensions</CardDescription>
    </CardHeader>
    <CardContent>
      <FiveDChart scores={scores} explanations={explanations} />
    </CardContent>
  </Card>
);