#!/usr/bin/env node
/** Headed + slow-mo wrapper for run-suite (all smoke tests visible in browser). */
import fs from 'fs';
import { spawnSync } from 'child_process';
import { loadVerifyEnv, parseArgs } from './shared.mjs';

// #region agent log
function debugLog(message, data, hypothesisId) {
  const payload = {
    sessionId: '7ac3e1',
    location: 'watch-suite.mjs',
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
  };
  try {
    fs.appendFileSync('debug-7ac3e1.log', `${JSON.stringify(payload)}\n`);
  } catch {}
}
// #endregion

const passthrough = process.argv.slice(2);
const args = parseArgs(passthrough);
const env = loadVerifyEnv();

const childEnv = {
  ...process.env,
  ...env,
  VERIFY_HEADED: process.env.VERIFY_HEADED ?? '1',
  VERIFY_SLOW_MO: process.env.VERIFY_SLOW_MO ?? env.VERIFY_SLOW_MO ?? '300',
};

// #region agent log
debugLog('verify:watch-all start', {
  runId: args.run ?? '(auto)',
  suite: args.suite ?? 'smoke',
  verifyHeaded: childEnv.VERIFY_HEADED,
  verifySlowMo: childEnv.VERIFY_SLOW_MO,
}, 'H1-fix');
// #endregion

const result = spawnSync(
  process.execPath,
  ['.cursor/skills/verify-perleap/helpers/run-suite.mjs', ...passthrough],
  { stdio: 'inherit', env: childEnv, cwd: process.cwd() },
);

// #region agent log
debugLog('verify:watch-all complete', { exitStatus: result.status ?? 1 }, 'H1-fix');
// #endregion

process.exit(result.status ?? 1);
