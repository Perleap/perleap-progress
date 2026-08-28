#!/usr/bin/env node
/** Headed + slow-mo wrapper for full refactor QA (visible browser during E2E). */
import { spawnSync } from 'child_process';
import path from 'path';
import { loadVerifyEnv, parseArgs } from './shared.mjs';

const passthrough = process.argv.slice(2);
const env = loadVerifyEnv();

const childEnv = {
  ...process.env,
  ...env,
  VERIFY_HEADED: '1',
  VERIFY_SLOW_MO: process.env.VERIFY_SLOW_MO ?? env.VERIFY_SLOW_MO ?? '300',
};

const result = spawnSync(
  process.execPath,
  [path.join(process.cwd(), '.cursor/skills/verify-perleap/helpers/run-refactor-qa.mjs'), ...passthrough, '--watch', 'true'],
  { stdio: 'inherit', env: childEnv, cwd: process.cwd(), shell: false },
);

process.exit(result.status ?? 1);
