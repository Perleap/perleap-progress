#!/usr/bin/env node
/** Pre-prod staging gate: doctor → seed → refactor QA → infra scripts. */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs, REPO_ROOT } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const watch = args.watch === 'true';
const runId = args.run ?? `pre-prod-enchaning-${new Date().toISOString().slice(0, 10)}`;

const childEnv = {
  ...process.env,
  VERIFY_PROFILE: 'staging',
};

function runNode(relativeScript, scriptArgs = []) {
  const scriptPath = path.join(REPO_ROOT, relativeScript);
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    stdio: 'inherit',
    env: childEnv,
    cwd: REPO_ROOT,
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNpm(script, scriptArgs = []) {
  const result = spawnSync('npm', ['run', script, '--', ...scriptArgs], {
    stdio: 'inherit',
    env: childEnv,
    cwd: REPO_ROOT,
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`\n=== Pre-prod staging gate (${runId}) ===\n`);

runNode('.cursor/skills/verify-perleap/helpers/doctor.mjs');
runNpm('verify:seed');
runNpm('verify:seed-onboarding');

const qaScript = watch
  ? '.cursor/skills/verify-perleap/helpers/watch-refactor-qa-staging.mjs'
  : '.cursor/skills/verify-perleap/helpers/run-refactor-qa-staging.mjs';
runNode(qaScript, ['--run', runId]);

console.log('\n--- Infra scripts ---');
runNode('scripts/qa-cors-config.mjs');
runNode('scripts/qa-gateway-jwt.mjs');
runNode('scripts/qa-rls-config.mjs');
runNpm('test:edge');

console.log(`\n=== Pre-prod staging gate complete (${runId}) ===\n`);
