#!/usr/bin/env node
/**
 * Write .env.verify.staging (and merge keys into .env.local) from CI secrets.
 * Used by .github/workflows/e2e-smoke.yml — never commit output files.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function parseExisting(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function envOrFail(key) {
  const value = process.env[key]?.trim();
  if (!value) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(key) {
  return process.env[key]?.trim() ?? '';
}

function writeEnvFile(filePath, entries) {
  const lines = Object.entries(entries)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${value}`);
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

const stagingVerify = {
  VERIFY_PROFILE: 'staging',
  VERIFY_BASE_URL: optionalEnv('VERIFY_BASE_URL') || 'https://staging.perleap.ai',
  VERIFY_PORT: optionalEnv('VERIFY_PORT') || '443',
  VERIFY_STUDENT_EMAIL: envOrFail('VERIFY_STUDENT_EMAIL'),
  VERIFY_STUDENT_PASSWORD: optionalEnv('VERIFY_STUDENT_PASSWORD'),
  VERIFY_TEACHER_EMAIL: envOrFail('VERIFY_TEACHER_EMAIL'),
  VERIFY_TEACHER_PASSWORD: optionalEnv('VERIFY_TEACHER_PASSWORD'),
  VERIFY_ADMIN_EMAIL: optionalEnv('VERIFY_ADMIN_EMAIL'),
  VERIFY_ADMIN_PASSWORD: optionalEnv('VERIFY_ADMIN_PASSWORD'),
  VERIFY_AUTH_MODE: optionalEnv('VERIFY_AUTH_MODE') || 'auto',
  VERCEL_SHARE_TOKEN: optionalEnv('VERCEL_SHARE_TOKEN'),
  VERCEL_AUTOMATION_BYPASS_SECRET: optionalEnv('VERCEL_AUTOMATION_BYPASS_SECRET'),
  VERIFY_HEADED: '0',
  VERIFY_KEEP_OPEN: '0',
};

writeEnvFile(path.join(REPO_ROOT, '.env.verify.staging'), stagingVerify);

const localPath = path.join(REPO_ROOT, '.env.local');
writeEnvFile(localPath, {
  ...parseExisting(localPath),
  VITE_SUPABASE_URL: envOrFail('VITE_SUPABASE_URL'),
  VITE_SUPABASE_ANON_KEY: envOrFail('VITE_SUPABASE_ANON_KEY'),
  VITE_SUPABASE_SECRET_KEY: envOrFail('VITE_SUPABASE_SECRET_KEY'),
});

console.log('Wrote .env.verify.staging and merged Supabase keys into .env.local for CI smoke');
