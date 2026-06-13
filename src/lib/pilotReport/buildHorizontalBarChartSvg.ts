export type HorizontalBarChartItem = {
  label: string;
  value: number;
};

export type BuildHorizontalBarChartSvgOptions = {
  items: HorizontalBarChartItem[];
  width?: number;
  rowHeight?: number;
  barColor?: string;
  maxValue?: number;
  valueSuffix?: string;
  ariaLabel?: string;
};

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateLabel(label: string, max = 28): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + '…';
}

/** Self-contained SVG horizontal bar chart for offline HTML export. */
export function buildHorizontalBarChartSvg(options: BuildHorizontalBarChartSvgOptions): string {
  const {
    items,
    width = 720,
    rowHeight = 36,
    barColor = '#3369B7',
    maxValue = 100,
    valueSuffix = '',
    ariaLabel = 'Bar chart',
  } = options;

  if (items.length === 0) return '';

  const paddingTop = 8;
  const paddingBottom = 8;
  const labelWidth = Math.min(220, width * 0.34);
  const barAreaX = labelWidth + 12;
  const barAreaWidth = width - barAreaX - 48;
  const height = paddingTop + items.length * rowHeight + paddingBottom;

  const rows = items
    .map((item, i) => {
      const y = paddingTop + i * rowHeight;
      const barY = y + 10;
      const pct = maxValue > 0 ? Math.max(0, Math.min(100, (item.value / maxValue) * 100)) : 0;
      const barW = (barAreaWidth * pct) / 100;
      const displayLabel = escapeSvgText(truncateLabel(item.label));
      const displayValue = `${Math.round(item.value)}${valueSuffix}`;

      return `<g>
  <text x="0" y="${barY + 8}" font-size="12" font-weight="600" fill="#1B3A6B">${displayLabel}</text>
  <rect x="${barAreaX}" y="${barY}" width="${barAreaWidth}" height="14" rx="3" fill="#dde8f4"/>
  <rect x="${barAreaX}" y="${barY}" width="${barW.toFixed(1)}" height="14" rx="3" fill="${barColor}"/>
  <text x="${(barAreaX + barAreaWidth + 8).toFixed(1)}" y="${barY + 11}" font-size="11" font-weight="700" fill="#1B3A6B">${displayValue}</text>
</g>`;
    })
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="${escapeSvgText(ariaLabel)}">
  ${rows}
</svg>`;
}
