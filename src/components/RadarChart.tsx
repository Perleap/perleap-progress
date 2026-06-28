import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { DIMENSION_CONFIG, QED_LAYER_CONFIG } from '@/config/constants';
import type { FiveDDimensionKey, FiveDScores, FiveDQedMeasures } from '@/types/models';
import { FIVE_D_DIMENSION_KEYS } from '@/lib/fiveDScores';
import {
  getLayerChartValue,
  hasDualLayerQedData,
  type QedLayerKey,
} from '@/lib/qedMeasures';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface RadarChartProps {
  scores: FiveDScores;
  qedMeasures?: FiveDQedMeasures | null;
  explanations?: Partial<Record<keyof FiveDScores, string>> | null;
  showLabels?: boolean;
  height?: number;
  /** Side-by-side legend (default) or stacked centered chart for compact/PDF views. */
  layerControlsLayout?: 'side' | 'stacked';
}

type ChartPoint = {
  dimension: FiveDDimensionKey;
  label: string;
  developmentValue: number;
  motivationValue: number;
  developmentRaw: number | null;
  motivationRaw: number | null;
  phase: 'up' | 'down' | null;
  next: string | null;
  explanation: string;
  scoreRaw: number | null;
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
    payload: ChartPoint;
  }>;
  visibleLayers: Set<QedLayerKey>;
  showMotivationLayer: boolean;
}

const CustomTooltip = ({
  active,
  payload,
  visibleLayers,
  showMotivationLayer,
}: CustomTooltipProps) => {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;
  const blurb =
    point.next ||
    point.explanation ||
    t(`dimensions.${point.dimension}.description`);

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 max-w-xs z-50">
      <p className="font-semibold text-sm mb-2">{t(`dimensions.${point.dimension}.label`)}</p>
      {visibleLayers.has('development') ? (
        <p className="text-xs mb-1" style={{ color: QED_LAYER_CONFIG.development.color }}>
          {t('qedLayers.development')}:{' '}
          {point.developmentRaw != null ? (
            <span className="font-bold">{point.developmentRaw}/100</span>
          ) : point.developmentValue > 0 ? (
            <span className="font-bold">{Math.round(point.developmentValue)}/100</span>
          ) : (
            <span>{t('dimensions.notAssessable', { defaultValue: 'N/A' })}</span>
          )}
        </p>
      ) : null}
      {showMotivationLayer && visibleLayers.has('motivation') ? (
        <p className="text-xs mb-1" style={{ color: QED_LAYER_CONFIG.motivation.color }}>
          {t('qedLayers.motivation')}:{' '}
          {point.motivationRaw != null ? (
            <span className="font-bold">{point.motivationRaw}/100</span>
          ) : point.motivationValue > 0 ? (
            <span className="font-bold">{Math.round(point.motivationValue)}/100</span>
          ) : (
            <span>{t('dimensions.notAssessable', { defaultValue: 'N/A' })}</span>
          )}
        </p>
      ) : null}
      {point.phase ? (
        <p className="text-xs text-muted-foreground mb-2">
          {t('qedLayers.phase')}:{' '}
          {point.phase === 'up' ? t('qedLayers.phaseUp') : t('qedLayers.phaseDown')}
        </p>
      ) : null}
      {point.next ? (
        <p className="text-xs text-muted-foreground border-t pt-2 mt-2 leading-relaxed">
          <span className="font-medium">{t('qedLayers.nextStep')}: </span>
          {point.next}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground border-t pt-2 mt-2 leading-relaxed">{blurb}</p>
      )}
    </div>
  );
};

function layerOpacity(layer: QedLayerKey, hoveredLayer: QedLayerKey | null, visible: boolean): number {
  if (!visible) return 0;
  if (hoveredLayer === null) return 1;
  return hoveredLayer === layer ? 1 : 0.25;
}

export const RadarChart = ({
  scores,
  qedMeasures,
  explanations,
  showLabels = true,
  height = 400,
  layerControlsLayout = 'side',
}: RadarChartProps) => {
  const { t } = useTranslation();
  const [hoveredDimension, setHoveredDimension] = useState<FiveDDimensionKey | null>(null);
  const [hoveredLayer, setHoveredLayer] = useState<QedLayerKey | null>(null);
  const dualLayer = hasDualLayerQedData(qedMeasures);
  const [showDevelopment, setShowDevelopment] = useState(true);
  const [showMotivation, setShowMotivation] = useState(true);

  useEffect(() => {
    setShowMotivation(dualLayer);
    setShowDevelopment(true);
  }, [dualLayer]);

  const stacked = layerControlsLayout === 'stacked';

  const data: ChartPoint[] = useMemo(
    () =>
      FIVE_D_DIMENSION_KEYS.map((dimension) => {
        const devChart = getLayerChartValue(qedMeasures, dimension, 'development', scores[dimension]);
        const motChart = getLayerChartValue(qedMeasures, dimension, 'motivation', null);
        const dimQed = qedMeasures?.[dimension];
        return {
          dimension,
          label: t(`dimensions.${dimension}.label`),
          developmentValue: devChart ?? 0,
          motivationValue: motChart ?? 0,
          developmentRaw: dimQed?.development ?? null,
          motivationRaw: dimQed?.motivation ?? null,
          phase: dimQed?.phase ?? null,
          next: dimQed?.next ?? null,
          explanation: explanations?.[dimension] || '',
          scoreRaw: scores[dimension],
        };
      }),
    [scores, qedMeasures, explanations, t],
  );

  const visibleLayers = useMemo(() => {
    const set = new Set<QedLayerKey>();
    if (showDevelopment) set.add('development');
    if (dualLayer && showMotivation) set.add('motivation');
    return set;
  }, [showDevelopment, showMotivation, dualLayer]);

  const devConfig = QED_LAYER_CONFIG.development;
  const motConfig = QED_LAYER_CONFIG.motivation;
  const devOpacity = layerOpacity('development', hoveredLayer, showDevelopment);
  const motOpacity = layerOpacity('motivation', hoveredLayer, dualLayer && showMotivation);

  return (
    <div className="w-full">
      <div
        className={
          stacked
            ? 'flex flex-col items-center gap-3'
            : 'flex flex-col sm:flex-row gap-4 items-stretch'
        }
      >
        <div className={stacked ? 'w-full' : 'flex-1 min-w-0'}>
          <ResponsiveContainer width="100%" height={height}>
            <RechartsRadarChart
              data={data}
              margin={
                stacked
                  ? { top: 12, right: 28, bottom: 12, left: 28 }
                  : { top: 8, right: 36, bottom: 8, left: 36 }
              }
            >
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="label"
                tick={({ payload, x, y, textAnchor }) => {
                  const dimension = data[payload.index].dimension;
                  const isHovered = hoveredDimension === dimension;
                  const color = DIMENSION_CONFIG[dimension].color;
                  const isTopAxis = dimension === 'vision';
                  const tickY = typeof y === 'number' ? y : Number(y);

                  return (
                    <text
                      x={x}
                      y={isTopAxis ? tickY - 10 : tickY}
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
                domain={[0, 100]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              />
              {showDevelopment ? (
                <Radar
                  name={t('qedLayers.development')}
                  dataKey="developmentValue"
                  stroke={devConfig.color}
                  fill={devConfig.color}
                  fillOpacity={devConfig.fillOpacity * devOpacity}
                  strokeWidth={devConfig.strokeWidth}
                  strokeOpacity={devOpacity}
                  isAnimationActive={false}
                />
              ) : null}
              {dualLayer && showMotivation ? (
                <Radar
                  name={t('qedLayers.motivation')}
                  dataKey="motivationValue"
                  stroke={motConfig.color}
                  fill={motConfig.color}
                  fillOpacity={motConfig.fillOpacity * motOpacity}
                  strokeWidth={motConfig.strokeWidth}
                  strokeOpacity={motOpacity}
                  strokeDasharray={motConfig.dash}
                  isAnimationActive={false}
                />
              ) : null}
              <Tooltip
                content={({ active, payload }) => (
                  <CustomTooltip
                    active={active}
                    payload={payload as CustomTooltipProps['payload']}
                    visibleLayers={visibleLayers}
                    showMotivationLayer={dualLayer}
                  />
                )}
              />
            </RechartsRadarChart>
          </ResponsiveContainer>
        </div>

        <div
          className={
            stacked
              ? 'flex flex-row flex-wrap justify-center gap-4 w-full'
              : 'flex sm:flex-col justify-center gap-4 sm:min-w-[10rem] sm:border-s sm:ps-4 border-border shrink-0'
          }
          onMouseLeave={() => setHoveredLayer(null)}
        >
          <div
            className="flex items-start gap-2 rounded-lg p-2 transition-opacity cursor-default"
            style={{ opacity: hoveredLayer === 'motivation' ? 0.5 : 1 }}
            onMouseEnter={() => setHoveredLayer('development')}
          >
            <Checkbox
              id="qed-layer-development"
              checked={showDevelopment}
              onCheckedChange={(v) => setShowDevelopment(v === true)}
            />
            <Label htmlFor="qed-layer-development" className="cursor-pointer leading-tight">
              <span
                className="inline-block w-3 h-3 rounded-full me-1.5 align-middle"
                style={{ backgroundColor: devConfig.color }}
              />
              {t('qedLayers.development')}
            </Label>
          </div>
          {dualLayer ? (
            <div
              className="flex items-start gap-2 rounded-lg p-2 transition-opacity cursor-default"
              style={{ opacity: hoveredLayer === 'development' ? 0.5 : 1 }}
              onMouseEnter={() => setHoveredLayer('motivation')}
            >
              <Checkbox
                id="qed-layer-motivation"
                checked={showMotivation}
                onCheckedChange={(v) => setShowMotivation(v === true)}
              />
              <Label htmlFor="qed-layer-motivation" className="cursor-pointer leading-tight">
                <span
                  className="inline-block w-3 h-3 rounded-full me-1.5 align-middle border border-dashed"
                  style={{
                    backgroundColor: motConfig.color,
                    borderColor: motConfig.color,
                  }}
                />
                {t('qedLayers.motivation')}
              </Label>
            </div>
          ) : null}
        </div>
      </div>

      {showLabels ? (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIVE_D_DIMENSION_KEYS.map((dimension) => {
            const config = DIMENSION_CONFIG[dimension];
            const point = data.find((d) => d.dimension === dimension)!;
            const explanation = explanations?.[dimension];
            const isHovered = hoveredDimension === dimension;

            return (
              <div
                key={dimension}
                className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer ${isHovered ? 'bg-card shadow-md scale-105 ring-1' : 'bg-muted/30'}`}
                style={
                  { '--tw-ring-color': isHovered ? config.color : 'transparent' } as React.CSSProperties
                }
                onMouseEnter={() => setHoveredDimension(dimension)}
                onMouseLeave={() => setHoveredDimension(null)}
              >
                <div
                  className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1 gap-2">
                    <span className={`text-sm font-semibold ${isHovered ? 'text-foreground' : ''}`}>
                      {t(`dimensions.${dimension}.label`)}
                    </span>
                    <div className="text-end shrink-0">
                      {showDevelopment ? (
                        <span
                          className="text-xs font-bold block"
                          style={{ color: devConfig.color }}
                        >
                          D:{' '}
                          {point.developmentRaw != null
                            ? `${point.developmentRaw}/100`
                            : point.scoreRaw != null
                              ? `${Math.round(point.scoreRaw * 10)}/100`
                              : t('dimensions.notAssessable', { defaultValue: 'N/A' })}
                        </span>
                      ) : null}
                      {dualLayer && showMotivation && point.motivationRaw != null ? (
                        <span
                          className="text-xs font-bold block"
                          style={{ color: motConfig.color }}
                        >
                          M: {point.motivationRaw}/100
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {point.next || explanation || t(`dimensions.${dimension}.description`)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
