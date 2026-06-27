import { describe, it, expect } from 'vitest';
import { buildPilotReportHtml, escapeHtml } from './buildPilotReportHtml';
import { basePilotReport, assessedParticipant, failedParticipant } from './testFixtures';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("x") & more</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;) &amp; more&lt;/script&gt;',
    );
  });
});

describe('buildPilotReportHtml', () => {
  it('renders participant names in the appendix (internal report)', () => {
    const html = buildPilotReportHtml(basePilotReport);
    const appendix = html.split('Appendix — Participant Summaries')[1] ?? '';
    expect(appendix).toContain('Dana Cohen');
    expect(html).not.toContain('Participant Decision Table');
  });

  it('shows course name, pilot dates, and scope facts in the title block', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('<p class="course-line">INSAIT Builders Pilot</p>');
    expect(html).toContain('Jan 1, 2026 – Mar 31, 2026');
    expect(html).toContain('Assignments in scope');
    expect(html).toContain('Cohort size');
  });

  it('renders localized readiness and role-fit labels', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('>Ready<');
    expect(html).toContain('Builder / implementer');
  });

  it('marks failed participants as not assessed and excludes them from the appendix', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('Not assessed: 1');
    const appendix = html.split('Appendix — Participant Summaries')[1] ?? '';
    expect(appendix).toContain('Dana Cohen');
    expect(appendix).not.toContain('Noa Levi');
  });

  it('renders the disclaimer without the internal badge', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('not a final diagnosis');
    expect(html).not.toContain('Internal — management use');
  });

  it('includes a readiness pie chart in the executive summary', () => {
    const html = buildPilotReportHtml(basePilotReport);
    const execSection = html.split('Executive Summary')[1]?.split('Appendix — Participant Summaries')[0] ?? '';
    expect(execSection).toContain('<svg');
    expect(execSection).toContain('viewBox="0 0 820 280"');
    expect(html).not.toContain('Cohort Capability Snapshot');
  });

  it('renders role-fit distribution and participants assessed in executive summary', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('1 of 2');
    expect(html).toContain('Recommended role-fit distribution');
    expect(html).toContain('Builder / implementer: 1');
  });

  it('places methodology legend before the executive summary without weighting or confidence', () => {
    const html = buildPilotReportHtml(basePilotReport);
    const legendIdx = html.indexOf('How to read this report');
    const execIdx = html.indexOf('Executive Summary');
    expect(legendIdx).toBeGreaterThan(-1);
    expect(execIdx).toBeGreaterThan(legendIdx);
    expect(html).not.toContain('builder execution 30%');
    expect(html).not.toContain('Confidence reflects evidence quality');
  });

  it('renders methodology legend and report ID in footer', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('How to read this report');
    expect(html).toContain('Readiness labels');
    expect(html).toContain('PR-insait-builders-pilot-20260611-A1B2');
  });

  it('embeds logo when logoDataUri is present', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('<img class="cover-logo"');
    expect(html).toContain('data:image/svg+xml;base64,PHN2Zy8+');
  });

  it('renders card badges, completion percent, and three-column summary in appendix', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('appendix-card-header');
    expect(html).toContain('card-badges');
    expect(html).toContain('card-badge-numeric');
    expect(html).not.toContain('card-badge-cell');
    expect(html).toContain('#1');
    expect(html).toContain('83%');
    expect(html).toContain('appendix-summary-grid');
    expect(html).toContain('appendix-summary-col-strength');
    expect(html).toContain('appendix-summary-col-risk');
    expect(html).toContain('appendix-summary-col-action');
    expect(html).toContain('Ships working builds quickly.');
    expect(html).toContain('Gets stuck on multi-step debugging.');
    expect(html).toContain('Assign to supervised client build.');
    expect(html).not.toContain('Why this decision');
    expect(html).not.toContain('appendix-meta');
    expect(html).not.toContain('padding-inline-end: 9.5rem');
    const appendix = html.split('Appendix — Participant Summaries')[1] ?? '';
    expect(appendix).toContain('signal-row');
    expect(appendix).toContain('signal-value');
  });

  it('escapes script injection in participant fields', () => {
    const html = buildPilotReportHtml({
      ...basePilotReport,
      participants: [
        {
          ...assessedParticipant,
          name: '<script>alert(1)</script>',
          keyStrength: '<img src=x onerror=alert(1)>',
        },
        failedParticipant,
      ],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders cohort counts without recommendation or findings in executive summary', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('Participants assessed');
    expect(html).not.toContain('Move 1 participant into a supervised builder track now.');
    expect(html).not.toContain('Strongest capability');
    expect(html).not.toContain('AI-generated decisions.');
  });

  it('does not render a numbered section 02 decision table', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).not.toContain('Participant Decision Table');
    expect(html).not.toContain('>02<');
  });

  it('includes pdf-block markers for block-based PDF export', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('title-block pdf-block');
    expect(html).toContain('appendix-intro-card');
    expect(html).toContain('footer pdf-block');
  });

  it('sets RTL direction for Hebrew reports', () => {
    const html = buildPilotReportHtml({
      ...basePilotReport,
      meta: { ...basePilotReport.meta, language: 'he', dir: 'rtl' },
    });
    expect(html).toContain('<html lang="he" dir="rtl">');
  });
});
