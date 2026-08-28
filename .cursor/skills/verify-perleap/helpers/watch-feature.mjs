#!/usr/bin/env node
/** Sets VERIFY_HEADED=1, starts verify server, runs drive-feature, then cleans up. */
import { spawnSync } from 'child_process';
import { parseArgs, fail, loadVerifyEnv } from './shared.mjs';

const passthrough = process.argv.slice(2);
const args = parseArgs(passthrough);

if (!args.id) {
  fail('Usage: verify:watch -- --id <feature-id> [--run <run-id>]');
}

const env = loadVerifyEnv();
const childEnv = {
  ...process.env,
  ...env,
  VERIFY_HEADED: process.env.VERIFY_HEADED ?? '1',
  VERIFY_SLOW_MO: process.env.VERIFY_SLOW_MO ?? env.VERIFY_SLOW_MO ?? '300',
};

function runNpm(script, extraArgs = []) {
  const npmResult = spawnSync('npm', ['run', script, '--', ...extraArgs], {
    stdio: 'inherit',
    shell: true,
    env: childEnv,
    cwd: process.cwd(),
  });
  if (npmResult.status !== 0) {
    fail(`npm run ${script} failed`);
  }
}

runNpm('verify:launch');

const result = spawnSync(
  process.execPath,
  ['.cursor/skills/verify-perleap/helpers/drive-feature.mjs', ...passthrough],
  { stdio: 'inherit', env: childEnv, cwd: process.cwd() },
);

if (result.status === 0 && env.VERIFY_KEEP_OPEN !== '1') {
  runNpm('verify:cleanup');
}

process.exit(result.status ?? 1);
