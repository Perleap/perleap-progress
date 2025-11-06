import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface FiveDChartProps {
  scores: {
    cognitive: number;
    emotional: number;
    social: number;
    creative: number;
    behavioral: number;
  };
  showLabels?: boolean;
}

const dimensions = [
  { key: 'cognitive', label: 'Cognitive', color: 'bg-dimension-cognitive', description: 'Critical thinking & problem solving' },
  { key: 'emotional', label: 'Emotional', color: 'bg-dimension-emotional', description: 'Self-awareness & empathy' },
  { key: 'social', label: 'Social', color: 'bg-dimension-social', description: 'Collaboration & communication' },
  { key: 'creative', label: 'Creative', color: 'bg-dimension-creative', description: 'Innovation & expression' },
  { key: 'behavioral', label: 'Behavioral', color: 'bg-dimension-behavioral', description: 'Discipline & persistence' }
] as const;

export const FiveDChart = ({ scores, showLabels = true }: FiveDChartProps) => {
  return (
    <div className="space-y-4">
      {dimensions.map(({ key, label, color, description }) => (
        <div key={key} className="space-y-2">
          {showLabels && (
            <div className="flex justify-between items-baseline">
              <div>
                <span className="text-sm font-medium">{label}</span>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <span className="text-sm font-bold">{scores[key].toFixed(1)}/5</span>
            </div>
          )}
          <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
            <div
              className={`h-full ${color} transition-all duration-500 ease-out rounded-full`}
              style={{ width: `${(scores[key] / 5) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export const FiveDChartCard = ({ scores, title = "5D Growth Profile" }: FiveDChartProps & { title?: string }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Track development across five key dimensions</CardDescription>
      </CardHeader>
      <CardContent>
        <FiveDChart scores={scores} />
      </CardContent>
    </Card>
  );
};