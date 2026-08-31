#!/usr/bin/env node
/** Full refactor QA against staging.perleap.ai (no local Vite server). */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, 'run-refactor-qa.mjs');
const passthrough = process.argv.slice(2);

const childEnv = {
  ...process.env,
  VERIFY_PROFILE: 'staging',
};

const result = spawnSync(process.execPath, [script, ...passthrough], {
  stdio: 'inherit',
  env: childEnv,
  shell: false,
});

process.exit(result.status ?? 1);
