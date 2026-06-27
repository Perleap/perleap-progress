export type PieChartSegment = {
  label: string;
  value: number;
  color: string;
};

export type BuildPieChartSvgOptions = {
  segments: PieChartSegment[];
  width?: number;
  height?: number;
  ariaLabel?: string;
  centerLabel?: string;
};

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

/** Self-contained SVG pie/donut chart for offline HTML export. */
export function buildPieChartSvg(options: BuildPieChartSvgOptions): string {
  const {
    segments,
    width = 820,
    height = 280,
    ariaLabel = 'Pie chart',
    centerLabel,
  } = options;

  const nonZero = segments.filter((s) => s.value > 0);
  const total = nonZero.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return '';

  const padding = 24;
  const r = 105;
  const innerR = 55;
  const cx = width / 2;
  const cy = height / 2;
  const swatchWidth = 12;
  const swatchGap = 8;
  const lineHeight = 22;

  const legendLabels = nonZero.map((seg) => `${seg.label}: ${seg.value}`);
  const maxLegendTextWidth = Math.max(
    ...legendLabels.map((label) => label.length * 6.2),
    72,
  );
  const legendRight = width - padding;
  const swatchX = legendRight - maxLegendTextWidth - swatchGap - swatchWidth;
  const legendStartY = padding + 12;

  let angle = 0;

  const slices = nonZero
    .map((seg) => {
      const sweep = (seg.value / total) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      const path =
        sweep >= 359.99
          ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${seg.color}"/>`
          : `<path d="${describeArc(cx, cy, r, start, end)}" fill="${seg.color}"/>`;
      return path;
    })
    .join('\n  ');

  const legend = nonZero
    .map((seg, i) => {
      const y = legendStartY + i * lineHeight;
      const label = `${seg.label}: ${seg.value}`;
      return `<g>
  <rect x="${swatchX.toFixed(1)}" y="${(y - 10).toFixed(1)}" width="${swatchWidth}" height="${swatchWidth}" rx="2" fill="${seg.color}"/>
  <text x="${legendRight}" y="${y.toFixed(1)}" text-anchor="end" font-size="11" font-weight="600" fill="#1B3A6B">${escapeSvgText(label)}</text>
</g>`;
    })
    .join('\n  ');

  const center =
    centerLabel != null && centerLabel.length > 0
      ? `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="16" font-weight="700" fill="#1B3A6B">${escapeSvgText(centerLabel)}</text>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="${escapeSvgText(ariaLabel)}">
  ${slices}
  <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#fff"/>
  ${center}
  ${legend}
</svg>`;
}

export const READINESS_PIE_COLORS = {
  ready: '#1E7A45',
  coach: '#946300',
  redirect: '#5B41A8',
  not_ready: '#B43333',
  not_assessed: '#888888',
} as const;
