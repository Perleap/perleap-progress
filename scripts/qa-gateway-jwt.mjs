/**
 * Staging QA helper: anon-key calls to JWT-gated functions should return 401 at the gateway.
 *
 * Usage:
 *   set SUPABASE_URL=https://<project>.supabase.co
 *   set SUPABASE_ANON_KEY=<anon-key>
 *   node scripts/qa-gateway-jwt.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '..', 'supabase', 'config.toml');
const config = readFileSync(configPath, 'utf8');

const mustBeTrue = [
  'generate-feedback',
  'regenerate-scores',
  'extract-unit-memory',
  'compute-nuance-insights',
  'transcribe-live-session',
  'evaluate-from-feedback',
  'rephrase-text',
  'teacher-assistant-chat',
  'speech-to-text',
  'text-to-speech',
  'generate-followup-assignment',
];

const mustBeFalse = ['analyze-student-wellbeing', 'collect-metric-snapshot'];

function readVerifyJwt(functionName) {
  const block = new RegExp(
    `\\[functions\\.${functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\][\\s\\S]*?verify_jwt\\s*=\\s*(true|false)`,
    'm',
  ).exec(config);
  return block?.[1] ?? null;
}

let failed = false;

for (const fn of mustBeTrue) {
  const value = readVerifyJwt(fn);
  if (value !== 'true') {
    console.error(`FAIL config: ${fn} should have verify_jwt=true (got ${value ?? 'missing'})`);
    failed = true;
  } else {
    console.log(`OK config: ${fn} verify_jwt=true`);
  }
}

for (const fn of mustBeFalse) {
  const value = readVerifyJwt(fn);
  if (value !== 'false') {
    console.error(`FAIL config: ${fn} should have verify_jwt=false (got ${value ?? 'missing'})`);
    failed = true;
  } else {
    console.log(`OK config: ${fn} verify_jwt=false`);
  }
}

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const anonKey = process.env.SUPABASE_ANON_KEY;

if (supabaseUrl && anonKey) {
  const liveChecks = ['generate-feedback', 'rephrase-text'];
  for (const fn of liveChecks) {
    const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (res.status === 401) {
      console.log(`OK live: ${fn} anon call returned 401`);
    } else {
      console.error(`FAIL live: ${fn} anon call returned ${res.status} (expected 401)`);
      failed = true;
    }
  }
} else {
  console.log('SKIP live gateway checks (set SUPABASE_URL and SUPABASE_ANON_KEY to run)');
}

if (failed) {
  process.exit(1);
}

console.log('Gateway JWT QA passed');
