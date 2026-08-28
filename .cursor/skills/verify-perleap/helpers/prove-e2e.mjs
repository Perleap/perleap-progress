import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { chromium } from 'playwright';
import {
  loadVerifyEnv,
  evidenceDirForRun,
  makeRunId,
  writeManifest,
  ENGLISH_INIT_SCRIPT,
  SKILL_ROOT,
  fail,
} from './shared.mjs';

const runId = process.argv[2] ?? makeRunId();
const env = loadVerifyEnv();
const hasStudentCreds = Boolean(env.VERIFY_STUDENT_EMAIL && env.VERIFY_STUDENT_PASSWORD);

function runNpm(script, extraArgs = []) {
  const result = spawnSync('npm', ['run', script, '--', ...extraArgs], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    fail(`npm run ${script} failed`);
  }
}

async function authPageSmoke(evidenceDir) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en-US' });
  await context.addInitScript(ENGLISH_INIT_SCRIPT);
  const page = await context.newPage();
  await page.goto(`${env.VERIFY_BASE_URL}/auth`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Sign in with email' }).waitFor({ timeout: 15_000 });
  const screenshotPath = path.join(evidenceDir, 'auth-page-smoke.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  writeManifest(evidenceDir, {
    runId,
    featureId: 'auth-page-smoke',
    proofLevel: 'infra-only',
    blockedReason: 'VERIFY_STUDENT_EMAIL/PASSWORD not set — full student-auth-dashboard skipped',
    baseURL: env.VERIFY_BASE_URL,
    finalUrl: page.url(),
    proof: 'Auth page loads with Sign in with email heading',
    screenshot: path.relative(SKILL_ROOT, screenshotPath),
    timestamp: new Date().toISOString(),
  });
  await browser.close();
  console.log('verify-perleap: auth-page infra smoke OK (credentials needed for full dashboard proof)');
}

async function main() {
  runNpm('verify:launch');
  runNpm('verify:doctor');

  const evidenceDir = evidenceDirForRun(runId);
  fs.mkdirSync(evidenceDir, { recursive: true });

  if (hasStudentCreds) {
    runNpm('verify:login', ['--role', 'student']);
    runNpm('verify:feature', ['--id', 'student-auth-dashboard', '--run', runId]);
  } else {
    await authPageSmoke(evidenceDir);
  }

  const manifestPath = path.join(evidenceDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    fail(`Expected evidence manifest at ${manifestPath}`);
  }

  runNpm('verify:cleanup');

  if (!fs.existsSync(manifestPath)) {
    fail('Evidence manifest was removed during cleanup');
  }

  console.log(`verify-perleap: proof complete — evidence at ${evidenceDir}`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
