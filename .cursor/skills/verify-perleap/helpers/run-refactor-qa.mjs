#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  loadVerifyEnv,
  makeRunId,
  parseArgs,
  fail,
  evidenceDirForRun,
  REPO_ROOT,
} from './shared.mjs';

const args = parseArgs(process.argv.slice(2));
const runId = args.run ?? `refactor-qa-${new Date().toISOString().slice(0, 10)}`;
const watch = args.watch === 'true' || process.env.VERIFY_HEADED === '1';
const env = loadVerifyEnv();
const runDir = evidenceDirForRun(runId);
fs.mkdirSync(runDir, { recursive: true });

const startedAt = new Date().toISOString();
fs.writeFileSync(
  path.join(runDir, 'qa-meta.json'),
  JSON.stringify({ startedAt, watch, runId }, null, 2),
);

function spawnShell(command, opts = {}) {
  return spawnSync(command, {
    stdio: opts.inherit === false ? 'pipe' : 'inherit',
    shell: true,
    env: { ...process.env, ...env, ...(opts.env ?? {}) },
    cwd: REPO_ROOT,
    encoding: opts.inherit === false ? 'utf8' : undefined,
  });
}

function spawn(cmd, cmdArgs, opts = {}) {
  return spawnSync(cmd, cmdArgs, {
    stdio: opts.inherit === false ? 'pipe' : 'inherit',
    shell: false,
    env: { ...process.env, ...env, ...(opts.env ?? {}) },
    cwd: REPO_ROOT,
    encoding: opts.inherit === false ? 'utf8' : undefined,
  });
}

function runNode(relativeScript, scriptArgs, opts = {}) {
  const scriptPath = path.join(REPO_ROOT, relativeScript);
  return spawn(process.execPath, [scriptPath, ...scriptArgs], opts);
}

let exitCode = 0;

console.log(`\n=== Refactor QA (${runId}) ===\n`);

// 1) Unit tests → JSON
console.log('--- Unit tests ---');
const unitOut = path.join(runDir, 'unit-results.json');
const unitResult = spawnShell(
  `npx vitest run --reporter=json --outputFile "${unitOut.replace(/"/g, '\\"')}"`,
  { inherit: false },
);
if (unitResult.status !== 0) {
  exitCode = 1;
  console.error('Unit tests failed');
  if (unitResult.stderr) console.error(unitResult.stderr.slice(0, 500));
}
if (fs.existsSync(unitOut)) {
  const unit = JSON.parse(fs.readFileSync(unitOut, 'utf8'));
  console.log(`Unit: ${unit.numPassedTests}/${unit.numTotalTests} passed`);
} else {
  console.error('Missing unit-results.json');
  exitCode = 1;
}

// 2) i18n
console.log('\n--- i18n ---');
const i18nResult = runNode('scripts/check-i18n-keys.mjs', [], { inherit: false });
const i18nStdout = i18nResult.stdout ?? '';
const missingMatch = i18nStdout.match(/Missing count:\s*(\d+)/);
const missingCount = missingMatch ? Number(missingMatch[1]) : null;
fs.writeFileSync(
  path.join(runDir, 'i18n-result.json'),
  JSON.stringify(
    {
      ok: i18nResult.status === 0 && missingCount === 0,
      missingCount,
      stdout: i18nStdout.trim(),
    },
    null,
    2,
  ),
);
if (i18nResult.status !== 0 || missingCount !== 0) {
  exitCode = 1;
  console.error(`i18n failed (missing: ${missingCount})`);
} else {
  console.log('i18n: 0 missing keys');
}

// 3) E2E suite
console.log('\n--- E2E (refactor-regression) ---');
const suiteEnv = {
  ...(watch ? { VERIFY_HEADED: '1', VERIFY_SLOW_MO: env.VERIFY_SLOW_MO ?? '300' } : {}),
};
const suiteResult = runNode(
  '.cursor/skills/verify-perleap/helpers/run-suite.mjs',
  [
    '--suite',
    'refactor-regression',
    '--run',
    runId,
    '--continue-on-fail',
    'true',
  ],
  { env: suiteEnv },
);
if (suiteResult.status !== 0) {
  exitCode = 1;
  console.error('E2E suite had failures');
}

// 4) HTML report
const finishedAt = new Date().toISOString();
const meta = JSON.parse(fs.readFileSync(path.join(runDir, 'qa-meta.json'), 'utf8'));
meta.finishedAt = finishedAt;
meta.exitCode = exitCode;
fs.writeFileSync(path.join(runDir, 'qa-meta.json'), JSON.stringify(meta, null, 2));

runNode('.cursor/skills/verify-perleap/helpers/generate-qa-report.mjs', ['--run', runId]);

const reportPath = path.join(runDir, 'index.html');
console.log(`\n=== Done (${exitCode === 0 ? 'PASS' : 'FAIL'}) ===`);
console.log(`Report: file:///${reportPath.replace(/\\/g, '/')}`);

if (exitCode !== 0) {
  fail(`Refactor QA failed — see ${reportPath}`);
}
