import { buildHorizontalBarChartSvg } from './buildHorizontalBarChartSvg';
import {
  PILOT_DIMENSION_KEYS,
  type PilotParticipantRow,
  type PilotReportData,
  type PilotReportStaticCopy,
} from './types';
import { buildRoleFitDistributionLine, countNotAssessed } from './buildPilotReportData';

const BLUE = {
  primary: '#3369B7',
  dark: '#1B3A6B',
  labelBg: '#E8F0FA',
  headerBg: '#D6E4F5',
  border: '#B8CFE8',
  pillBg: '#D6E4F5',
  pillText: '#3369B7',
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

function readinessPillClass(readiness: PilotParticipantRow['readiness']): string {
  switch (readiness) {
    case 'ready':
      return 'pill pill-ready';
    case 'coach':
      return 'pill pill-coach';
    case 'redirect':
      return 'pill pill-redirect';
    case 'not_ready':
      return 'pill pill-notready';
    default:
      return 'pill';
  }
}

const INLINE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, 'Segoe UI', sans-serif;
    background: #eef2f7;
    color: #1a1a1a;
    line-height: 1.5;
    padding: 2rem 1rem;
    counter-reset: page;
  }
  .doc {
    max-width: 860px;
    margin: 0 auto;
    background: #fff;
    border: 1px solid ${BLUE.border};
    box-shadow: 0 2px 12px rgba(27, 58, 107, 0.08);
  }
  .title-block {
    text-align: center;
    padding: 2rem 2rem 1.5rem;
    background: linear-gradient(180deg, ${BLUE.headerBg} 0%, #fff 100%);
    border-bottom: 1px solid ${BLUE.border};
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
  .recommendation {
    font-size: 0.9rem;
    color: #333;
    padding: 0.875rem 1rem;
    background: ${BLUE.labelBg};
    border-bottom: 1px solid ${BLUE.border};
    line-height: 1.6;
  }
  .findings { padding: 0.75rem 1rem; border-bottom: 1px solid ${BLUE.border}; }
  .findings li { font-size: 0.85rem; color: #333; margin-bottom: 0.35rem; margin-inline-start: 1.1rem; }
  .findings li:last-child { margin-bottom: 0; }
  .findings .finding-label { font-weight: 700; color: ${BLUE.dark}; }
  .chart-wrap { padding: 1rem; }
  .chart-wrap svg { display: block; width: 100%; height: auto; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .data-table th {
    text-align: start;
    font-size: 0.7rem;
    font-weight: 700;
    color: ${BLUE.dark};
    padding: 0.55rem 0.65rem;
    background: ${BLUE.headerBg};
    border-bottom: 1px solid ${BLUE.border};
  }
  .data-table td {
    padding: 0.55rem 0.65rem;
    border-bottom: 1px solid ${BLUE.border};
    vertical-align: top;
  }
  .data-table tr:last-child td { border-bottom: none; }
  .pill {
    display: inline-block;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
    white-space: nowrap;
    background: ${BLUE.pillBg};
    color: ${BLUE.pillText};
    border: 1px solid ${BLUE.border};
  }
  .pill-ready { background: #E2F5EA; color: #1E7A45; border-color: #B5E0C6; }
  .pill-coach { background: #FFF4DC; color: #946300; border-color: #EFD9A2; }
  .pill-redirect { background: #EDE8FA; color: #5B41A8; border-color: #CFC3EE; }
  .pill-notready { background: #FDE8E8; color: #B43333; border-color: #ECB8B8; }
  .appendix-card {
    border: 1px solid ${BLUE.border};
    background: #f7fafd;
    padding: 0.875rem 1rem;
    margin: 0 1rem 0.75rem;
  }
  .appendix-grid { padding-top: 1rem; padding-bottom: 0.25rem; }
  .appendix-name { font-size: 0.95rem; font-weight: 700; color: ${BLUE.dark}; }
  .appendix-meta { font-size: 0.75rem; color: #555; margin: 0.2rem 0 0.5rem; }
  .appendix-line { font-size: 0.8rem; color: #333; margin-bottom: 0.25rem; }
  .appendix-line strong { color: ${BLUE.dark}; }
  .appendix-signals { margin: 0.5rem 0; }
  .appendix-signals svg { display: block; width: 100%; max-width: 480px; height: auto; }
  .appendix-why { font-size: 0.78rem; color: #333; margin: 0.35rem 0 0.5rem 1.1rem; }
  .appendix-why li { margin-bottom: 0.2rem; }
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
    .print-footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 0.65rem; color: #aaa; }
    .print-footer::after { content: counter(page); }
  }
`;

function buildParticipantSignalsChart(
  p: PilotParticipantRow,
  staticCopy: PilotReportStaticCopy,
): string {
  if (!p.dimensions) return '';
  return buildHorizontalBarChartSvg({
    items: PILOT_DIMENSION_KEYS.map((key) => ({
      label: staticCopy.dimensionLabels[key],
      value: p.dimensions![key],
    })),
    width: 480,
    rowHeight: 22,
    ariaLabel: `${staticCopy.appendixObservedSignals}: ${p.name}`,
  });
}

function buildScopeFactsHtml(meta: PilotReportData['meta']): string {
  if (!meta.pilotDateRange) return '';
  return `<p class="scope-facts">${escapeHtml(meta.pilotDateRange)}</p>`;
}

export function buildPilotReportHtml(data: PilotReportData): string {
  const { meta, cohort, summary, participants, staticCopy } = data;
  const dir = meta.dir;
  const lang = meta.language;

  const notAssessedCount = countNotAssessed(participants);
  const participantsValue = `${cohort.participantsAssessed} of ${cohort.participantsTotal}`;
  const roleFitLine = buildRoleFitDistributionLine(cohort.roleFitCounts, staticCopy.roleFitLabels);

  const cohortRows: [string, string][] = [
    [staticCopy.cohortParticipants, participantsValue],
    [staticCopy.cohortReady, String(cohort.readinessCounts.ready)],
    [staticCopy.cohortCoach, String(cohort.readinessCounts.coach)],
    [staticCopy.cohortRedirect, String(cohort.readinessCounts.redirect)],
    [staticCopy.cohortNotReady, String(cohort.readinessCounts.not_ready)],
  ];
  if (notAssessedCount > 0) {
    cohortRows.push([staticCopy.cohortNotAssessed, String(notAssessedCount)]);
  }
  if (roleFitLine) {
    cohortRows.push([staticCopy.cohortRoleFitDistribution, roleFitLine]);
  }

  const cohortRowsHtml = cohortRows
    .map(
      ([label, value]) =>
        `<tr><td class="lv-label">${escapeHtml(label)}</td><td class="lv-value lv-bold">${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  const findings = [
    [staticCopy.findingStrongest, summary.strongestCapability],
    [staticCopy.findingGap, summary.mainGap],
    [staticCopy.findingNextAction, summary.topNextAction],
  ]
    .filter(([, text]) => text.trim().length > 0)
    .map(
      ([label, text]) =>
        `<li><span class="finding-label">${escapeHtml(label)}:</span> ${escapeHtml(text)}</li>`,
    )
    .join('');

  const snapshotChart = cohort.meanDimensions
    ? buildHorizontalBarChartSvg({
        items: PILOT_DIMENSION_KEYS.map((key) => ({
          label: staticCopy.dimensionLabels[key],
          value: cohort.meanDimensions![key],
        })),
        ariaLabel: staticCopy.sectionCapabilitySnapshot,
      })
    : '';

  const decisionRows = participants
    .map((p) => {
      if (!p.assessed) {
        return `<tr>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td colspan="6" style="color:#888">${escapeHtml(staticCopy.notAssessed)}</td>
        </tr>`;
      }
      return `<tr>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td><span class="${readinessPillClass(p.readiness)}">${escapeHtml(p.readiness ? staticCopy.readinessLabels[p.readiness] : staticCopy.noData)}</span></td>
        <td>${escapeHtml(p.roleFit ? staticCopy.roleFitLabels[p.roleFit] : staticCopy.noData)}</td>
        <td>${escapeHtml(p.keyStrength || staticCopy.noData)}</td>
        <td>${escapeHtml(p.mainRisk || staticCopy.noData)}</td>
        <td>${escapeHtml(p.nextAction || staticCopy.noData)}</td>
        <td>${escapeHtml(p.confidence ? staticCopy.confidenceLabels[p.confidence] : staticCopy.noData)}</td>
      </tr>`;
    })
    .join('');

  const appendixCards = participants
    .filter((p) => p.assessed)
    .map((p) => {
      const signalsChart = buildParticipantSignalsChart(p, staticCopy);
      const whyHtml =
        p.whyBullets.length > 0
          ? `<p class="appendix-line"><strong>${escapeHtml(staticCopy.appendixWhyBullets)}:</strong></p><ul class="appendix-why">${p.whyBullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
          : '';
      return `<div class="appendix-card">
        <p class="appendix-name">${escapeHtml(p.name)}</p>
        <p class="appendix-meta">
          ${escapeHtml(p.roleFit ? staticCopy.roleFitLabels[p.roleFit] : staticCopy.noData)} ·
          ${escapeHtml(p.readiness ? staticCopy.readinessLabels[p.readiness] : staticCopy.noData)} ·
          ${escapeHtml(p.confidence ? staticCopy.confidenceLabels[p.confidence] : staticCopy.noData)} ·
          ${escapeHtml(staticCopy.appendixCompleted)}: ${p.completedInScope}/${p.assignmentsInScope}
        </p>
        ${signalsChart ? `<div class="appendix-signals">${signalsChart}</div>` : ''}
        ${whyHtml}
        ${p.keyStrength ? `<p class="appendix-line">${escapeHtml(p.keyStrength)}</p>` : ''}
        ${p.mainRisk ? `<p class="appendix-line"><strong>${escapeHtml(staticCopy.appendixRisk)}:</strong> ${escapeHtml(p.mainRisk)}</p>` : ''}
        ${p.nextAction ? `<p class="appendix-line"><strong>${escapeHtml(staticCopy.appendixNextAction)}:</strong> ${escapeHtml(p.nextAction)}</p>` : ''}
      </div>`;
    })
    .join('');

  const logoHtml = meta.logoDataUri
    ? `<img class="cover-logo" src="${meta.logoDataUri}" alt="Perleap" />`
    : '';

  const legendHtml = `<div class="legend-box">
    <h4>${escapeHtml(staticCopy.sectionMethodology)}</h4>
    <p><strong>${escapeHtml(staticCopy.legendReadinessTitle)}</strong></p>
    <p>${escapeHtml(staticCopy.legendReadinessReady)}</p>
    <p>${escapeHtml(staticCopy.legendReadinessCoach)}</p>
    <p>${escapeHtml(staticCopy.legendReadinessRedirect)}</p>
    <p>${escapeHtml(staticCopy.legendReadinessNotReady)}</p>
    <p>${escapeHtml(staticCopy.legendWeighting)}</p>
    <p>${escapeHtml(staticCopy.legendConfidence)}</p>
  </div>`;

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
    <header class="title-block">
      ${logoHtml}
      <p class="cover-eyebrow">${escapeHtml(staticCopy.coverEyebrow)}</p>
      <h1 class="doc-title">${escapeHtml(staticCopy.coverTitle)}</h1>
      <p class="course-line">${escapeHtml(meta.classroomLabel)}</p>
      ${buildScopeFactsHtml(meta)}
    </header>

    <div class="section">
      ${sectionBar('01', staticCopy.sectionExecutiveSummary)}
      <table class="lv-table">${cohortRowsHtml}</table>
      ${summary.recommendation ? `<p class="recommendation">${escapeHtml(summary.recommendation)}</p>` : ''}
      ${findings ? `<ul class="findings">${findings}</ul>` : ''}
    </div>

    ${
      snapshotChart
        ? `<div class="section">
      ${sectionBar('02', staticCopy.sectionCapabilitySnapshot)}
      <p class="section-note">${escapeHtml(staticCopy.sectionCapabilitySnapshotDesc)}</p>
      <div class="chart-wrap">${snapshotChart}</div>
    </div>`
        : ''
    }

    <div class="section">
      ${sectionBar(snapshotChart ? '03' : '02', staticCopy.sectionDecisionTable)}
      <p class="section-note">${escapeHtml(staticCopy.sectionDecisionTableDesc)}</p>
      <table class="data-table">
        <thead><tr>
          <th>${escapeHtml(staticCopy.colParticipant)}</th>
          <th>${escapeHtml(staticCopy.colReadiness)}</th>
          <th>${escapeHtml(staticCopy.colFit)}</th>
          <th>${escapeHtml(staticCopy.colStrength)}</th>
          <th>${escapeHtml(staticCopy.colRisk)}</th>
          <th>${escapeHtml(staticCopy.colNextAction)}</th>
          <th>${escapeHtml(staticCopy.colConfidence)}</th>
        </tr></thead>
        <tbody>${decisionRows}</tbody>
      </table>
    </div>

    ${
      appendixCards
        ? `<div class="section">
      ${sectionBar('', staticCopy.sectionAppendix)}
      <p class="section-note">${escapeHtml(staticCopy.sectionAppendixDesc)}</p>
      <div class="appendix-grid">${appendixCards}</div>
    </div>`
        : ''
    }

    ${legendHtml}

    <footer class="footer">
      <p>${escapeHtml(staticCopy.footerDisclaimer)}</p>
      <p class="footer-meta">${escapeHtml(staticCopy.reportIdLabel)}: ${escapeHtml(meta.reportId)} · ${escapeHtml(meta.generatedAtDisplay)}</p>
    </footer>
  </div>
  <div class="print-footer" aria-hidden="true"></div>
</body>
</html>`;
}
