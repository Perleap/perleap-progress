#!/usr/bin/env node
/** Headed + slow-mo wrapper for staging refactor QA. */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const passthrough = process.argv.slice(2);

const childEnv = {
  ...process.env,
  VERIFY_PROFILE: 'staging',
  VERIFY_HEADED: '1',
  VERIFY_SLOW_MO: process.env.VERIFY_SLOW_MO ?? '300',
};

const result = spawnSync(
  process.execPath,
  [path.join(__dirname, 'run-refactor-qa-staging.mjs'), ...passthrough, '--watch', 'true'],
  { stdio: 'inherit', env: childEnv, shell: false },
);

process.exit(result.status ?? 1);
