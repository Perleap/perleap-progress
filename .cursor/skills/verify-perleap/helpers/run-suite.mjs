#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  loadVerifyEnv,
  isRemoteVerifyTarget,
  makeRunId,
  parseArgs,
  fail,
  evidenceDirForRun,
  SKILL_ROOT,
} from './shared.mjs';
import { getFeature } from '../features/registry.mjs';

const args = parseArgs(process.argv.slice(2));
const suiteName = args.suite ?? 'smoke';
const runId = args.run ?? makeRunId();
const continueOnFail = args['continue-on-fail'] === 'true';
const env = loadVerifyEnv();

const suitePath = path.join(SKILL_ROOT, 'features', 'suites', `${suiteName}.json`);
if (!fs.existsSync(suitePath)) {
  fail(`Suite not found: ${suitePath}`);
}

/** @type {string[]} */
const featureIds = JSON.parse(fs.readFileSync(suitePath, 'utf8'));

function runNpm(script, extraArgs = []) {
  const result = spawnSync('npm', ['run', script, '--', ...extraArgs], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
    cwd: process.cwd(),
  });
  if (result.status !== 0) {
    fail(`npm run ${script} ${extraArgs.join(' ')} failed`);
  }
}

function runNpmSoft(script, extraArgs = []) {
  const result = spawnSync('npm', ['run', script, '--', ...extraArgs], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
    cwd: process.cwd(),
  });
  return result.status === 0;
}

const studentFeatures = featureIds.filter((id) => getFeature(id)?.role === 'student');
const teacherFeatures = featureIds.filter((id) => getFeature(id)?.role === 'teacher');
const onboardingStudentFeatures = featureIds.filter(
  (id) => getFeature(id)?.role === 'onboarding-student',
);
const onboardingTeacherFeatures = featureIds.filter(
  (id) => getFeature(id)?.role === 'onboarding-teacher',
);
const adminFeatures = featureIds.filter((id) => getFeature(id)?.role === 'admin');
const anonymousFeatures = featureIds.filter((id) => getFeature(id)?.role === 'anonymous');
const unknown = featureIds.filter((id) => !getFeature(id));
if (unknown.length) {
  fail(`Unknown feature ids in suite: ${unknown.join(', ')}`);
}

const remote = isRemoteVerifyTarget(env.VERIFY_BASE_URL);
if (remote) {
  console.log(`verify-perleap: remote target ${env.VERIFY_BASE_URL} — skipping local dev server`);
}

runNpm('verify:seed');
if (onboardingStudentFeatures.length || onboardingTeacherFeatures.length) {
  runNpm('verify:seed-onboarding');
}
if (!remote) {
  runNpm('verify:launch');
}
runNpm('verify:doctor');

const suiteEvidenceDir = evidenceDirForRun(runId);
const results = [];

function runFeature(featureId) {
  const featureRunId = `${runId}/${featureId}`;
  const started = Date.now();
  const ok = runNpmSoft('verify:feature', ['--id', featureId, '--run', featureRunId]);
  results.push({
    featureId,
    role: getFeature(featureId).role,
    status: ok ? 'ok' : 'fail',
    error: ok ? null : 'verify:feature exited non-zero',
    durationMs: Date.now() - started,
  });
  if (!ok && !continueOnFail) {
    fail(`Suite stopped on ${featureId}`);
  }
}

for (const id of anonymousFeatures) {
  runFeature(id);
}

if (studentFeatures.length) {
  runNpm('verify:login', ['--role', 'student']);
  for (const id of studentFeatures) {
    runFeature(id);
  }
}

if (teacherFeatures.length) {
  runNpm('verify:login', ['--role', 'teacher']);
  for (const id of teacherFeatures) {
    runFeature(id);
  }
}

if (onboardingStudentFeatures.length) {
  runNpm('verify:reset-onboarding', ['--role', 'student']);
  runNpm('verify:login-onboarding', ['--role', 'student']);
  for (const id of onboardingStudentFeatures) {
    runFeature(id);
  }
}

if (onboardingTeacherFeatures.length) {
  runNpm('verify:reset-onboarding', ['--role', 'teacher']);
  runNpm('verify:login-onboarding', ['--role', 'teacher']);
  for (const id of onboardingTeacherFeatures) {
    runFeature(id);
  }
}

if (adminFeatures.length) {
  runNpm('verify:login', ['--role', 'admin']);
  for (const id of adminFeatures) {
    runFeature(id);
  }
}

const manifest = {
  runId,
  suite: suiteName,
  baseURL: env.VERIFY_BASE_URL,
  featureCount: featureIds.length,
  passed: results.filter((r) => r.status === 'ok').length,
  failed: results.filter((r) => r.status === 'fail').length,
  results,
  timestamp: new Date().toISOString(),
};

fs.writeFileSync(path.join(suiteEvidenceDir, 'suite-manifest.json'), JSON.stringify(manifest, null, 2));

if (!remote && env.VERIFY_KEEP_OPEN !== '1') {
  runNpm('verify:cleanup');
}

if (manifest.failed > 0) {
  fail(`Suite ${suiteName} had ${manifest.failed} failure(s)`);
}

console.log(`verify-perleap: suite ${suiteName} OK (${manifest.passed}/${manifest.featureCount})`);
console.log(`verify-perleap: suite evidence → ${suiteEvidenceDir}`);
