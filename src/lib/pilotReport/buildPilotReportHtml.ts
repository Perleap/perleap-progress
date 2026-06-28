import { buildPieChartSvg, READINESS_PIE_COLORS } from './buildPieChartSvg';
import {
  PILOT_DIMENSION_KEYS,
  PILOT_READINESS_VALUES,
  type PilotParticipantRow,
  type PilotReportData,
  type PilotReportStaticCopy,
} from './types';
import {
  buildRoleFitDistributionLine,
  countNotAssessed,
  formatCompletionPercent,
  rankParticipantsForAppendix,
} from './buildPilotReportData';

const BLUE = {
  primary: '#3369B7',
  dark: '#1B3A6B',
  labelBg: '#E8F0FA',
  headerBg: '#D6E4F5',
  border: '#B8CFE8',
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sectionBar(num: string, title: string): string {
  const numPart = num ? `<span class="section-num">${num}</span> ` : '';
  return `<div class="section-bar">${numPart}${escapeHtml(title)}</div>`;
}

function readinessBadgeClass(readiness: PilotParticipantRow['readiness']): string {
  switch (readiness) {
    case 'ready':
      return 'card-badge-readiness-ready';
    case 'coach':
      return 'card-badge-readiness-coach';
    case 'redirect':
      return 'card-badge-readiness-redirect';
    case 'not_ready':
      return 'card-badge-readiness-notready';
    default:
      return 'card-badge-neutral';
  }
}

const INLINE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, 'Segoe UI', sans-serif;
    background: #fff;
    color: #1a1a1a;
    line-height: 1.5;
    padding: 0;
    margin: 0;
    counter-reset: page;
  }
  .doc {
    width: 860px;
    max-width: 860px;
    margin: 0;
    background: #fff;
    border: none;
    box-shadow: none;
  }
  .title-block {
    text-align: center;
    padding: 2rem 2rem 1.5rem;
    background: linear-gradient(180deg, ${BLUE.headerBg} 0%, #fff 100%);
    border-bottom: 1px solid ${BLUE.border};
  }
  .pdf-block {
    break-inside: avoid;
    page-break-inside: avoid;
    width: 100%;
    overflow: visible;
    box-sizing: border-box;
  }
  .cover-eyebrow { font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; color: ${BLUE.primary}; font-weight: 700; }
  .cover-logo { height: 36px; margin: 0 auto 0.75rem; display: block; }
  .scope-facts { font-size: 0.75rem; color: #666; margin-top: 0.5rem; line-height: 1.5; }
  .doc-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 2rem;
    font-weight: 700;
    color: ${BLUE.dark};
    margin: 0.25rem 0;
  }
  .course-line { font-size: 0.9rem; color: ${BLUE.dark}; font-weight: 600; margin-top: 0.75rem; }
  .section { break-inside: avoid; }
  .section-bar {
    background: ${BLUE.primary};
    color: #fff;
    text-align: center;
    font-size: 0.95rem;
    font-weight: 700;
    padding: 0.55rem 1rem;
    letter-spacing: 0.02em;
  }
  .section-num { opacity: 0.85; font-size: 0.8rem; margin-inline-end: 0.35rem; }
  .section-note {
    font-size: 0.75rem;
    color: ${BLUE.primary};
    padding: 0.5rem 1rem;
    background: #f7fafd;
    border-bottom: 1px solid ${BLUE.border};
  }
  .lv-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  .lv-table tr { border-bottom: 1px solid ${BLUE.border}; }
  .lv-table tr:last-child { border-bottom: none; }
  .lv-label {
    width: 40%;
    padding: 0.65rem 1rem;
    background: ${BLUE.labelBg};
    font-weight: 600;
    color: ${BLUE.dark};
    vertical-align: top;
    border-inline-end: 1px solid ${BLUE.border};
  }
  .lv-value { padding: 0.65rem 1rem; vertical-align: top; color: #333; }
  .lv-bold { font-weight: 700; font-size: 1rem; color: ${BLUE.dark}; }
  .chart-wrap { padding: 1.5rem; min-height: 280px; display: flex; align-items: center; border-bottom: 1px solid ${BLUE.border}; }
  .chart-wrap svg { display: block; width: 100%; height: auto; }
  .exec-meta { font-size: 0.85rem; color: #333; padding: 0.65rem 1rem; border-bottom: 1px solid ${BLUE.border}; line-height: 1.6; }
  .appendix-card {
    border: 1px solid ${BLUE.border};
    background: #f7fafd;
    padding: 0.875rem 1rem;
    margin: 0 0 0.75rem;
  }
  .appendix-intro-card .appendix-card {
    margin-bottom: 0;
  }
  .appendix-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }
  .card-badges {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
    direction: ltr;
  }
  .card-badge {
    width: 3.5rem;
    height: 3.5rem;
    min-width: 3.5rem;
    min-height: 3.5rem;
    border-radius: 999px;
    font-weight: 700;
    border: 2px solid #fff;
    box-sizing: border-box;
    flex-shrink: 0;
    display: inline-grid;
    place-items: center;
    justify-items: center;
    text-align: center;
    direction: ltr;
    padding: 0 0.25rem;
  }
  .card-badge-readiness { font-size: 0.55rem; line-height: 1.15; }
  .card-badge-numeric { font-size: 0.75rem; line-height: 1; padding: 0; }
  .card-badge-readiness-ready { background: #E2F5EA; color: #1E7A45; border-color: #B5E0C6; }
  .card-badge-readiness-coach { background: #FFF4DC; color: #946300; border-color: #EFD9A2; }
  .card-badge-readiness-redirect { background: #EDE8FA; color: #5B41A8; border-color: #CFC3EE; }
  .card-badge-readiness-notready { background: #FDE8E8; color: #B43333; border-color: #ECB8B8; }
  .card-badge-neutral { background: ${BLUE.labelBg}; color: ${BLUE.dark}; border-color: #fff; }
  .card-badge-rank { background: ${BLUE.primary}; color: #fff; border-color: #fff; }
  .appendix-grid { padding-top: 1rem; padding-bottom: 0.25rem; }
  .appendix-name { font-size: 0.95rem; font-weight: 700; color: ${BLUE.dark}; min-width: 0; }
  .appendix-signals { margin: 0.5rem 0; }
  .signal-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
  }
  .signal-row:last-child { margin-bottom: 0; }
  .signal-label {
    width: 9rem;
    flex-shrink: 0;
    font-size: 0.65rem;
    font-weight: 600;
    color: ${BLUE.dark};
  }
  .signal-bar-track {
    flex: 1;
    height: 8px;
    border-radius: 2px;
    overflow: hidden;
    background: #dde8f4;
  }
  .signal-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: ${BLUE.primary};
  }
  .signal-value {
    width: 2rem;
    text-align: end;
    font-size: 0.65rem;
    font-weight: 700;
    color: ${BLUE.dark};
  }
  .appendix-summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.5rem;
    width: 100%;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid ${BLUE.border};
    break-inside: avoid;
  }
  .appendix-summary-col {
    border-radius: 3px;
    padding: 0.5rem 0.65rem;
    font-size: 0.78rem;
    line-height: 1.45;
    min-width: 0;
  }
  .appendix-summary-col h5 {
    font-size: 0.72rem;
    font-weight: 700;
    margin-bottom: 0.35rem;
  }
  .appendix-summary-col-strength {
    background: #E2F5EA;
    border: 1px solid #B5E0C6;
    color: #1a5c35;
  }
  .appendix-summary-col-strength h5 { color: #1E7A45; }
  .appendix-summary-col-risk {
    background: #FDE8E8;
    border: 1px solid #ECB8B8;
    color: #8c2828;
  }
  .appendix-summary-col-risk h5 { color: #B43333; }
  .appendix-summary-col-action {
    background: #E8F0FA;
    border: 1px solid ${BLUE.border};
    color: #1B3A6B;
  }
  .appendix-summary-col-action h5 { color: ${BLUE.primary}; }
  .legend-box {
    padding: 0.875rem 1rem;
    margin: 0;
    font-size: 0.78rem;
    color: #333;
    line-height: 1.55;
    border-top: 1px solid ${BLUE.border};
    background: #f7fafd;
  }
  .legend-box h4 { font-size: 0.8rem; color: ${BLUE.dark}; margin-bottom: 0.35rem; }
  .legend-box p { margin-bottom: 0.35rem; }
  .footer-meta { margin-top: 0.35rem; font-size: 0.7rem; color: #aaa; }
  .footer {
    text-align: center;
    font-size: 0.75rem;
    color: #888;
    padding: 1.25rem 1rem;
    border-top: 1px solid ${BLUE.border};
    background: #f7fafd;
  }
  @page { margin: 1.2cm; }
  @media print {
    body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .doc { box-shadow: none; border: none; max-width: none; }
    .section, .title-block { break-inside: avoid; }
  }
`;

function buildParticipantSignalsHtml(
  p: PilotParticipantRow,
  staticCopy: PilotReportStaticCopy,
): string {
  if (!p.dimensions) return '';
  const rows = PILOT_DIMENSION_KEYS.map((key) => {
    const value = p.dimensions![key];
    const pct = Math.max(0, Math.min(100, value));
    const label = escapeHtml(staticCopy.dimensionLabels[key]);
    return `<div class="signal-row">
  <span class="signal-label">${label}</span>
  <div class="signal-bar-track"><div class="signal-bar-fill" style="width:${pct}%"></div></div>
  <span class="signal-value">${Math.round(value)}</span>
</div>`;
  }).join('\n');
  return rows;
}

function buildScopeFactsHtml(meta: PilotReportData['meta'], staticCopy: PilotReportStaticCopy): string {
  const lines: string[] = [];
  if (meta.pilotDateRange) lines.push(meta.pilotDateRange);
  lines.push(
    `${staticCopy.labelAssignmentsInScope}: ${meta.assignmentsInScope}`,
    `${staticCopy.labelCohortSize}: ${meta.cohortSize}`,
  );
  return `<p class="scope-facts">${lines.map((l) => escapeHtml(l)).join('<br>')}</p>`;
}

function buildLegendHtml(staticCopy: PilotReportStaticCopy): string {
  return `<div class="section pdf-block">
    ${sectionBar('', staticCopy.sectionMethodology)}
    <div class="legend-box">
      <p><strong>${escapeHtml(staticCopy.legendReadinessTitle)}</strong></p>
      <p>${escapeHtml(staticCopy.legendReadinessReady)}</p>
      <p>${escapeHtml(staticCopy.legendReadinessCoach)}</p>
      <p>${escapeHtml(staticCopy.legendReadinessRedirect)}</p>
      <p>${escapeHtml(staticCopy.legendReadinessNotReady)}</p>
    </div>
  </div>`;
}

function buildCardBadgesHtml(
  p: PilotParticipantRow & { rank: number },
  staticCopy: PilotReportStaticCopy,
): string {
  const readinessLabel = p.readiness
    ? staticCopy.readinessLabels[p.readiness]
    : staticCopy.noData;
  const readinessClass = p.readiness
    ? readinessBadgeClass(p.readiness)
    : 'card-badge-neutral';
  const completionPct = formatCompletionPercent(p.completedInScope, p.assignmentsInScope);
  return `<div class="card-badges">
  <div class="card-badge card-badge-readiness ${readinessClass}">${escapeHtml(readinessLabel)}</div>
  <div class="card-badge card-badge-neutral card-badge-numeric">${escapeHtml(completionPct)}</div>
  <div class="card-badge card-badge-rank card-badge-numeric">#${p.rank}</div>
</div>`;
}

function buildAppendixSummaryGridHtml(
  p: PilotParticipantRow,
  staticCopy: PilotReportStaticCopy,
): string {
  const cols: [string, string, string][] = [
    ['appendix-summary-col-strength', staticCopy.colStrength, p.keyStrength || staticCopy.noData],
    ['appendix-summary-col-risk', staticCopy.colRisk, p.mainRisk || staticCopy.noData],
    ['appendix-summary-col-action', staticCopy.colNextAction, p.nextAction || staticCopy.noData],
  ];
  const colHtml = cols
    .map(
      ([className, label, text]) =>
        `<div class="appendix-summary-col ${className}"><h5>${escapeHtml(label)}</h5><p>${escapeHtml(text)}</p></div>`,
    )
    .join('');
  return `<div class="appendix-summary-grid">${colHtml}</div>`;
}

function buildReadinessPieChart(
  cohort: PilotReportData['cohort'],
  staticCopy: PilotReportStaticCopy,
  notAssessedCount: number,
): string {
  const segments = PILOT_READINESS_VALUES.map((key) => ({
    label: staticCopy.readinessLabels[key],
    value: cohort.readinessCounts[key],
    color: READINESS_PIE_COLORS[key],
  }));
  if (notAssessedCount > 0) {
    segments.push({
      label: staticCopy.cohortNotAssessed,
      value: notAssessedCount,
      color: READINESS_PIE_COLORS.not_assessed,
    });
  }
  return buildPieChartSvg({
    segments,
    ariaLabel: staticCopy.sectionExecutiveSummary,
    centerLabel: String(cohort.participantsAssessed),
  });
}

export function buildPilotReportHtml(data: PilotReportData): string {
  const { meta, cohort, participants, staticCopy } = data;
  const dir = meta.dir;
  const lang = meta.language;

  const notAssessedCount = countNotAssessed(participants);
  const roleFitLine = buildRoleFitDistributionLine(cohort.roleFitCounts, staticCopy.roleFitLabels);
  const rankedAppendix = rankParticipantsForAppendix(participants);

  const pieChart = buildReadinessPieChart(cohort, staticCopy, notAssessedCount);

  const execMetaLines: string[] = [
    `${staticCopy.cohortParticipants}: ${cohort.participantsAssessed} of ${cohort.participantsTotal}`,
  ];
  if (roleFitLine) {
    execMetaLines.push(`${staticCopy.cohortRoleFitDistribution}: ${roleFitLine}`);
  }
  const execMetaHtml = execMetaLines
    .map((line) => `<p class="exec-meta">${escapeHtml(line)}</p>`)
    .join('');

  const appendixCards = rankedAppendix
    .map((p, index) => {
      const signalsHtml = buildParticipantSignalsHtml(p, staticCopy);
      const cardHtml = `<div class="appendix-card${index === 0 ? '' : ' pdf-block'}">
        <div class="appendix-card-header">
          <p class="appendix-name">${escapeHtml(p.name)}</p>
          ${buildCardBadgesHtml(p, staticCopy)}
        </div>
        ${signalsHtml ? `<div class="appendix-signals">${signalsHtml}</div>` : ''}
        ${buildAppendixSummaryGridHtml(p, staticCopy)}
      </div>`;

      if (index === 0) {
        return `<div class="pdf-block appendix-intro-card">
      ${sectionBar('', staticCopy.sectionAppendix)}
      <p class="section-note">${escapeHtml(staticCopy.sectionAppendixDesc)}</p>
      ${cardHtml}
    </div>`;
      }

      return cardHtml;
    })
    .join('');

  const logoHtml = meta.logoDataUri
    ? `<img class="cover-logo" src="${meta.logoDataUri}" alt="Perleap" />`
    : '';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(staticCopy.documentTitle)} – ${escapeHtml(meta.classroomLabel)}</title>
  <style>${INLINE_CSS}</style>
</head>
<body>
  <div class="doc">
    <header class="title-block pdf-block">
      ${logoHtml}
      <p class="cover-eyebrow">${escapeHtml(staticCopy.coverEyebrow)}</p>
      <h1 class="doc-title">${escapeHtml(staticCopy.coverTitle)}</h1>
      <p class="course-line">${escapeHtml(meta.classroomLabel)}</p>
      ${buildScopeFactsHtml(meta, staticCopy)}
    </header>

    ${buildLegendHtml(staticCopy)}

    <div class="section pdf-block">
      ${sectionBar('01', staticCopy.sectionExecutiveSummary)}
      ${pieChart ? `<div class="chart-wrap">${pieChart}</div>` : ''}
      ${execMetaHtml}
    </div>

    ${
      appendixCards
        ? `<div class="section">
      <div class="appendix-grid">${appendixCards}</div>
    </div>`
        : ''
    }

    <footer class="footer pdf-block">
      <p>${escapeHtml(staticCopy.footerDisclaimer)}</p>
      <p class="footer-meta">${escapeHtml(staticCopy.reportIdLabel)}: ${escapeHtml(meta.reportId)} · ${escapeHtml(meta.generatedAtDisplay)}</p>
    </footer>
  </div>
</body>
</html>`;
}
