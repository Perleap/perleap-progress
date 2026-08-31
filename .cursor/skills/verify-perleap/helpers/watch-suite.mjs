#!/usr/bin/env node
/** Headed + slow-mo wrapper for run-suite (all smoke tests visible in browser). */
import { spawnSync } from 'child_process';
import { loadVerifyEnv } from './shared.mjs';

const passthrough = process.argv.slice(2);
const env = loadVerifyEnv();

const childEnv = {
  ...process.env,
  ...env,
  VERIFY_HEADED: process.env.VERIFY_HEADED ?? '1',
  VERIFY_SLOW_MO: process.env.VERIFY_SLOW_MO ?? env.VERIFY_SLOW_MO ?? '300',
};

const result = spawnSync(
  process.execPath,
  ['.cursor/skills/verify-perleap/helpers/run-suite.mjs', ...passthrough],
  { stdio: 'inherit', env: childEnv, cwd: process.cwd() },
);

process.exit(result.status ?? 1);
