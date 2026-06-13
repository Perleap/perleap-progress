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
  it('renders the decision table with participant names (internal report)', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('Participant Decision Table');
    expect(html).toContain('Dana Cohen');
    expect(html).toContain('Noa Levi');
  });

  it('shows course name and pilot dates only in the title block', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('<p class="course-line">INSAIT Builders Pilot</p>');
    expect(html).toContain('Jan 1, 2026 – Mar 31, 2026');
    expect(html).not.toContain('Assignments in scope');
    expect(html).not.toContain('Cohort size');
  });

  it('renders localized readiness and role-fit labels', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('>Ready<');
    expect(html).toContain('Builder / implementer');
  });

  it('marks failed participants as not assessed and excludes them from the appendix', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('Not assessed — insufficient data or generation failed');
    const appendix = html.split('Appendix — Participant Summaries')[1] ?? '';
    expect(appendix).toContain('Dana Cohen');
    expect(appendix).not.toContain('Noa Levi');
  });

  it('renders the disclaimer without the internal badge', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('not a final diagnosis');
    expect(html).not.toContain('Internal — management use');
  });

  it('includes the capability snapshot bar chart SVG', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('<svg');
    expect(html).toContain('Cohort Capability Snapshot');
    expect(html).toContain('Builder execution');
  });

  it('omits the snapshot section when no participant was assessed', () => {
    const html = buildPilotReportHtml({
      ...basePilotReport,
      cohort: { ...basePilotReport.cohort, meanDimensions: null, participantsAssessed: 0 },
      participants: [failedParticipant],
    });
    expect(html).not.toContain('Cohort Capability Snapshot');
  });

  it('renders role-fit distribution and not-assessed count in executive summary', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('1 of 2');
    expect(html).toContain('Recommended role-fit distribution');
    expect(html).toContain('Builder / implementer: 1');
    expect(html).toContain('Not assessed');
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

  it('renders why-bullets and per-participant signal charts in appendix', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('Why this decision');
    expect(html).toContain('Completed 5 of 6 scoped assignments with working builds.');
    const appendix = html.split('Appendix — Participant Summaries')[1] ?? '';
    expect(appendix.match(/<svg/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
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

  it('renders cohort counts and the recommendation paragraph', () => {
    const html = buildPilotReportHtml(basePilotReport);
    expect(html).toContain('Participants assessed');
    expect(html).toContain('Move 1 participant into a supervised builder track now.');
    expect(html).toContain('Strongest capability');
  });

  it('sets RTL direction for Hebrew reports', () => {
    const html = buildPilotReportHtml({
      ...basePilotReport,
      meta: { ...basePilotReport.meta, language: 'he', dir: 'rtl' },
    });
    expect(html).toContain('<html lang="he" dir="rtl">');
  });
});
