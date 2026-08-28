#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { evidenceDirForRun, parseArgs, SKILL_ROOT } from './shared.mjs';

const TRACK_COVERAGE = {
  'A–B Teacher dashboard & classroom': [
    'teacher-auth-dashboard',
    'teacher-list-classrooms',
    'teacher-classroom-overview',
    'teacher-classroom-students-tab',
    'teacher-classroom-submissions-tab',
    'teacher-classroom-analytics-tab',
  ],
  'C Student classroom detail': ['student-classroom-detail', 'student-classroom-curriculum'],
  'D Submission detail': ['teacher-submission-detail'],
  'E Activity page': ['student-activity-page'],
  'F Assignment detail': [
    'student-assignment-detail',
    'student-view-assignment-list',
    'student-open-assignment-readonly',
    'student-open-essay',
    'student-open-quiz-mcq',
    'student-open-test-mode',
    'student-complete-chat',
  ],
  'G Live session': [],
  'H Settings': ['student-settings-profile', 'teacher-settings-profile'],
  'I Onboarding': [],
  'J Planner': ['teacher-planner-load'],
  'K Analytics': ['teacher-classroom-analytics-tab'],
  'L Auth & admin': ['auth-page-load', 'admin-ai-prompts', 'admin-monitoring-overview'],
  'M Polish (view modes + i18n gate)': ['student-dashboard-view-modes'],
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function featureEvidence(runDir, featureId) {
  const dir = path.join(runDir, featureId);
  const manifest = readJson(path.join(dir, 'manifest.json'));
  const png = path.join(dir, `${featureId}.png`);
  const failPng = path.join(dir, `${featureId}-failure.png`);
  const screenshot = fs.existsSync(png)
    ? `${featureId}/${featureId}.png`
    : fs.existsSync(failPng)
      ? `${featureId}/${featureId}-failure.png`
      : null;
  return { manifest, screenshot };
}

function statusBadge(ok) {
  return ok
    ? '<span class="badge pass">PASS</span>'
    : '<span class="badge fail">FAIL</span>';
}

function buildHtml(ctx) {
  const { runId, runDir, unit, i18n, suite, startedAt, finishedAt } = ctx;
  const featureResults = suite?.results ?? [];
  const featureStatus = new Map(featureResults.map((r) => [r.featureId, r.status === 'ok']));

  const unitPassed = unit?.numPassedTests ?? 0;
  const unitFailed = unit?.numFailedTests ?? 0;
  const unitTotal = unit?.numTotalTests ?? unitPassed + unitFailed;
  const i18nOk = (i18n?.missingCount ?? 1) === 0;
  const e2ePassed = featureResults.filter((r) => r.status === 'ok').length;
  const e2eFailed = featureResults.filter((r) => r.status === 'fail').length;
  const allOk = unitFailed === 0 && i18nOk && e2eFailed === 0;

  const trackRows = Object.entries(TRACK_COVERAGE)
    .map(([track, ids]) => {
      if (!ids.length) {
        return `<tr><td>${escapeHtml(track)}</td><td><em>Manual only</em></td><td>—</td></tr>`;
      }
      const ok = ids.every((id) => featureStatus.get(id) !== false);
      const covered = ids.filter((id) => featureStatus.has(id)).length;
      return `<tr><td>${escapeHtml(track)}</td><td>${ids.map((id) => `<code>${escapeHtml(id)}</code>`).join(', ')}</td><td>${statusBadge(ok && covered === ids.length)}</td></tr>`;
    })
    .join('\n');

  const featureRows = featureResults
    .map((r) => {
      const { manifest, screenshot } = featureEvidence(runDir, r.featureId);
      const proof = manifest?.proof ?? r.error ?? '—';
      const finalUrl = manifest?.finalUrl ?? '—';
      const thumb = screenshot
        ? `<a href="${escapeHtml(screenshot)}" target="_blank"><img src="${escapeHtml(screenshot)}" alt="${escapeHtml(r.featureId)}" loading="lazy" /></a>`
        : '—';
      return `<tr>
        <td><code>${escapeHtml(r.featureId)}</code></td>
        <td>${escapeHtml(r.role)}</td>
        <td>${statusBadge(r.status === 'ok')}</td>
        <td>${r.durationMs}ms</td>
        <td><small>${escapeHtml(finalUrl)}</small></td>
        <td>${escapeHtml(proof)}</td>
        <td class="thumb">${thumb}</td>
      </tr>`;
    })
    .join('\n');

  const failedTests =
    unit?.testResults
      ?.flatMap((file) =>
        (file.assertionResults ?? [])
          .filter((a) => a.status === 'failed')
          .map((a) => `<li><code>${escapeHtml(file.name)}</code> — ${escapeHtml(a.fullName ?? a.title)}</li>`),
      )
      .join('') ?? '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Perleap Refactor QA — ${escapeHtml(runId)}</title>
  <style>
    :root { font-family: system-ui, sans-serif; color: #111; background: #f6f7f9; }
    body { margin: 0; padding: 24px; max-width: 1400px; }
    h1 { margin: 0 0 8px; font-size: 1.6rem; }
    .summary { padding: 16px 20px; border-radius: 10px; margin-bottom: 24px; }
    .summary.pass { background: #e6f4ea; border: 1px solid #34a853; }
    .summary.fail { background: #fce8e6; border: 1px solid #ea4335; }
    section { background: #fff; border: 1px solid #ddd; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; }
    h2 { margin-top: 0; font-size: 1.15rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    th, td { border-bottom: 1px solid #eee; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #fafafa; }
    .badge { font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
    .badge.pass { background: #34a853; color: #fff; }
    .badge.fail { background: #ea4335; color: #fff; }
    .metrics { display: flex; flex-wrap: wrap; gap: 16px; margin: 12px 0; }
    .metric { background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 10px 14px; min-width: 140px; }
    .metric strong { display: block; font-size: 1.4rem; }
    img { max-width: 220px; max-height: 140px; border: 1px solid #ddd; border-radius: 6px; }
    code { font-size: 0.85em; }
    .meta { color: #555; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>Refactor QA Report</h1>
  <p class="meta">Run <code>${escapeHtml(runId)}</code> · ${escapeHtml(startedAt)} → ${escapeHtml(finishedAt)}</p>

  <div class="summary ${allOk ? 'pass' : 'fail'}">
    <strong>${allOk ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}</strong>
    <div class="metrics">
      <div class="metric"><strong>${unitPassed}/${unitTotal}</strong>Unit tests</div>
      <div class="metric"><strong>${i18nOk ? '0' : i18n?.missingCount ?? '?'}</strong>i18n missing keys</div>
      <div class="metric"><strong>${e2ePassed}/${featureResults.length}</strong>E2E features</div>
    </div>
  </div>

  <section>
    <h2>Track coverage (A–M)</h2>
    <table>
      <thead><tr><th>Track</th><th>Features</th><th>Status</th></tr></thead>
      <tbody>${trackRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Unit tests</h2>
    <p>${statusBadge(unitFailed === 0)} ${unitPassed} passed, ${unitFailed} failed</p>
    ${failedTests ? `<ul>${failedTests}</ul>` : ''}
  </section>

  <section>
    <h2>i18n</h2>
    <p>${statusBadge(i18nOk)} Missing keys: ${i18n?.missingCount ?? 'unknown'}</p>
  </section>

  <section>
    <h2>E2E features</h2>
    <p>Base URL: <code>${escapeHtml(suite?.baseURL ?? '—')}</code></p>
    <table>
      <thead><tr><th>Feature</th><th>Role</th><th>Status</th><th>Duration</th><th>Final URL</th><th>Proof</th><th>Screenshot</th></tr></thead>
      <tbody>${featureRows || '<tr><td colspan="7">No E2E results</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>Manual-only gaps</h2>
    <ul>
      <li>Track G — Live session (AI/audio)</li>
      <li>Track I — Full onboarding wizard (profile mutation)</li>
      <li>Track K — Lesson brief / pilot report deep flows</li>
      <li>Hebrew RTL view-mode strings</li>
    </ul>
  </section>
</body>
</html>`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = args.run;
  if (!runId) {
    console.error('Usage: node generate-qa-report.mjs --run <run-id>');
    process.exit(1);
  }

  const runDir = evidenceDirForRun(runId);
  const unit = readJson(path.join(runDir, 'unit-results.json'));
  const i18n = readJson(path.join(runDir, 'i18n-result.json'));
  const suite = readJson(path.join(runDir, 'suite-manifest.json'));
  const meta = readJson(path.join(runDir, 'qa-meta.json')) ?? {};

  const html = buildHtml({
    runId,
    runDir,
    unit,
    i18n,
    suite,
    startedAt: meta.startedAt ?? '—',
    finishedAt: meta.finishedAt ?? new Date().toISOString(),
  });

  const outPath = path.join(runDir, 'index.html');
  fs.writeFileSync(outPath, html);
  console.log(`verify-perleap: QA report → ${outPath}`);
  console.log(`Open: file:///${outPath.replace(/\\/g, '/')}`);
}

main();
