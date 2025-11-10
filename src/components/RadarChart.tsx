import { Radar, RadarChart as RechartsRadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { DIMENSION_CONFIG } from '@/config/constants';
import type { FiveDScores } from '@/types/models';

interface RadarChartProps {
  scores: FiveDScores;
  explanations?: Partial<Record<keyof FiveDScores, string>> | null;
  showLabels?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      dimension: string;
    };
  }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;

  const { dimension, value } = payload[0].payload as { dimension: keyof typeof DIMENSION_CONFIG; value: number };
  const config = DIMENSION_CONFIG[dimension];

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 max-w-xs">
      <p className="font-semibold text-sm mb-1">{config.label}</p>
      <p className="text-xs text-muted-foreground mb-2">
        Score: <span className="font-bold text-foreground">{value.toFixed(1)}/10</span>
      </p>
      <p className="text-xs text-muted-foreground italic border-t pt-2 mt-2">
        {config.description}
      </p>
    </div>
  );
};

export const RadarChart = ({ scores, explanations, showLabels = true }: RadarChartProps) => {
  const data = Object.entries(scores).map(([dimension, value]) => ({
    dimension,
    value,
    fullMark: 10,
    label: DIMENSION_CONFIG[dimension as keyof typeof DIMENSION_CONFIG].label,
  }));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={400}>
        <RechartsRadarChart data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis 
            dataKey="label" 
            tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 10]} 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.6}
            strokeWidth={2}
          />
          <Tooltip content={<CustomTooltip />} />
        </RechartsRadarChart>
      </ResponsiveContainer>
      
      {showLabels && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.keys(scores) as Array<keyof FiveDScores>).map((dimension) => {
            const config = DIMENSION_CONFIG[dimension];
            const explanation = explanations?.[dimension];
            const value = scores[dimension];
            
            return (
              <div key={dimension} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div 
                  className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-semibold">{config.label}</span>
                    <span className="text-sm font-bold">{value.toFixed(1)}/10</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {explanation || config.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

