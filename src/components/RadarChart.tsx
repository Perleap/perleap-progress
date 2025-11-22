import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { DIMENSION_CONFIG } from '@/config/constants';
import type { FiveDScores } from '@/types/models';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

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
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;

  const { dimension, value } = payload[0].payload as {
    dimension: keyof typeof DIMENSION_CONFIG;
    value: number;
  };

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 max-w-xs z-50">
      <p className="font-semibold text-sm mb-1">{t(`dimensions.${dimension}.label`)}</p>
      <p className="text-xs text-muted-foreground mb-2">
        {t('dimensions.score')}:{' '}
        <span className="font-bold text-foreground">{value.toFixed(1)}/10</span>
      </p>
      <p className="text-xs text-muted-foreground italic border-t pt-2 mt-2">
        {t(`dimensions.${dimension}.description`)}
      </p>
    </div>
  );
};

export const RadarChart = ({ scores, explanations, showLabels = true }: RadarChartProps) => {
  const { t } = useTranslation();
  const [hoveredDimension, setHoveredDimension] = useState<keyof FiveDScores | null>(null);

  // Use a consistent order from DIMENSION_CONFIG to ensure charts display dimensions in the same order
  const dimensionOrder: (keyof FiveDScores)[] = ['vision', 'values', 'thinking', 'connection', 'action'];

  const data = dimensionOrder.map((dimension) => ({
    dimension,
    value: scores[dimension] || 0,
    fullMark: 10,
    label: t(`dimensions.${dimension}.label`),
  }));

  // Calculate fill color based on hover state
  const getFillColor = () => {
    if (hoveredDimension) {
      return DIMENSION_CONFIG[hoveredDimension].color;
    }
    return "url(#rainbowGradient)";
  };

  const getStrokeColor = () => {
    if (hoveredDimension) {
      return DIMENSION_CONFIG[hoveredDimension].color;
    }
    return "#888888";
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={400}>
        <RechartsRadarChart data={data}>
          <defs>
            <linearGradient id="rainbowGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.6} />
              <stop offset="25%" stopColor="#EF4444" stopOpacity={0.6} />
              <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.6} />
              <stop offset="75%" stopColor="#10B981" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.6} />
            </linearGradient>
          </defs>

          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="label"
            tick={({ payload, x, y, textAnchor, ...props }) => {
              const dimension = data[payload.index].dimension as keyof FiveDScores;
              const isHovered = hoveredDimension === dimension;
              const color = DIMENSION_CONFIG[dimension].color;

              return (
                <text
                  x={x}
                  y={y}
                  textAnchor={textAnchor}
                  fill={isHovered ? color : 'hsl(var(--foreground))'}
                  fontSize={isHovered ? 14 : 12}
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHoveredDimension(dimension)}
                  onMouseLeave={() => setHoveredDimension(null)}
                >
                  {payload.value}
                </text>
              );
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 10]}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke={getStrokeColor()}
            fill={getFillColor()}
            fillOpacity={0.6}
            strokeWidth={2}
            isAnimationActive={true}
          />
          <Tooltip content={<CustomTooltip />} />
        </RechartsRadarChart>
      </ResponsiveContainer>

      {showLabels && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {dimensionOrder.map((dimension) => {
            const config = DIMENSION_CONFIG[dimension];
            const explanation = explanations?.[dimension];
            const value = scores[dimension] || 0;
            const isHovered = hoveredDimension === dimension;

            return (
              <div
                key={dimension}
                className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer ${isHovered ? 'bg-white shadow-md scale-105 ring-1' : 'bg-muted/30'}`}
                style={{ '--tw-ring-color': isHovered ? config.color : 'transparent' } as React.CSSProperties}
                onMouseEnter={() => setHoveredDimension(dimension)}
                onMouseLeave={() => setHoveredDimension(null)}
              >
                <div
                  className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className={`text-sm font-semibold ${isHovered ? 'text-foreground' : ''}`}>
                      {t(`dimensions.${dimension}.label`)}
                    </span>
                    <span className="text-sm font-bold">{value.toFixed(1)}/10</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {explanation || t(`dimensions.${dimension}.description`)}
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
