import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '../../../..');
export const SKILL_ROOT = path.resolve(__dirname, '..');
export const AUTH_DIR = path.join(SKILL_ROOT, '.auth');
export const RUN_DIR = path.join(SKILL_ROOT, '.run');
export const EVIDENCE_DIR = path.join(SKILL_ROOT, 'evidence');
export const FIXTURE_DIR = path.join(SKILL_ROOT, 'fixtures');
export const SANDBOX_FIXTURE_FILE = path.join(FIXTURE_DIR, 'sandbox.json');
export const RUN_STATE_FILE = path.join(RUN_DIR, 'server.json');

/** @param {string} filePath */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** @param {string | undefined} baseURL */
export function isRemoteVerifyTarget(baseURL) {
  if (!baseURL) return false;
  try {
    const host = new URL(baseURL).hostname.toLowerCase();
    return host !== 'localhost' && host !== '127.0.0.1';
  } catch {
    return false;
  }
}

export function loadVerifyEnv() {
  const profile = process.env.VERIFY_PROFILE ?? '';
  const profileFile =
    profile === 'staging'
      ? path.join(REPO_ROOT, '.env.verify.staging')
      : profile
        ? path.join(REPO_ROOT, `.env.verify.${profile}`)
        : null;

  const merged = {
    ...parseEnvFile(path.join(REPO_ROOT, '.env')),
    ...parseEnvFile(path.join(REPO_ROOT, '.env.local')),
    ...parseEnvFile(path.join(REPO_ROOT, '.env.verify')),
    ...(profileFile ? parseEnvFile(profileFile) : {}),
    ...process.env,
  };

  const port = merged.VERIFY_PORT ?? '8081';
  const baseURL = merged.VERIFY_BASE_URL ?? `http://127.0.0.1:${port}`;
  const normalizedBase = baseURL.replace(/\/$/, '');
  const remote = isRemoteVerifyTarget(normalizedBase);

  return {
    ...merged,
    VERIFY_PROFILE: profile || (remote ? 'remote' : 'local'),
    VERIFY_TARGET: remote ? 'remote' : 'local',
    VERIFY_REMOTE: remote ? '1' : '0',
    VERIFY_PORT: port,
    VERIFY_BASE_URL: normalizedBase,
    VITE_SUPABASE_URL: merged.VITE_SUPABASE_URL ?? '',
    VITE_SUPABASE_ANON_KEY:
      merged.VITE_SUPABASE_ANON_KEY ?? merged.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  };
}

/** @param {string} runId */
export function evidenceDirForRun(runId) {
  const dir = path.join(EVIDENCE_DIR, runId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function makeRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/** @param {string} role */
export function authStatePath(role) {
  return path.join(AUTH_DIR, `${role}.json`);
}

export function ensureSkillDirs() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.mkdirSync(RUN_DIR, { recursive: true });
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
}

function isTruthy(value) {
  return value === '1' || value === 'true' || value === true;
}

/** Playwright launch options from VERIFY_HEADED / VERIFY_SLOW_MO. */
export function getBrowserLaunchOptions(env = loadVerifyEnv()) {
  const slowMo = Number(env.VERIFY_SLOW_MO ?? 0);
  return {
    headless: !isTruthy(env.VERIFY_HEADED),
    ...(slowMo > 0 ? { slowMo } : {}),
  };
}

export function shouldKeepBrowserOpen(env = loadVerifyEnv()) {
  return isTruthy(env.VERIFY_KEEP_OPEN);
}

export function loadSandboxFixture() {
  if (!fs.existsSync(SANDBOX_FIXTURE_FILE)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(SANDBOX_FIXTURE_FILE, 'utf8'));
}

export function writeSandboxFixture(fixture) {
  ensureSkillDirs();
  fs.writeFileSync(SANDBOX_FIXTURE_FILE, JSON.stringify(fixture, null, 2));
}

export function navigationWaitUntil(env = loadVerifyEnv()) {
  return env.VERIFY_REMOTE === '1' ? 'domcontentloaded' : 'networkidle';
}

export function getVercelShareUrl(baseURL, token) {
  if (!token?.trim()) return null;
  const url = new URL(baseURL);
  url.searchParams.set('_vercel_share', token.trim());
  return url.toString();
}

export function getVercelProtectionHeaders(env = loadVerifyEnv()) {
  /** @type {Record<string, string>} */
  const headers = {};
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (bypass) headers['x-vercel-protection-bypass'] = bypass;
  const oidc = env.VERCEL_OIDC_TOKEN?.trim();
  if (oidc) headers['x-vercel-trusted-oidc-idp-token'] = oidc;
  return headers;
}

export function hasVercelProtectionCredentials(env = loadVerifyEnv()) {
  const headers = getVercelProtectionHeaders(env);
  return Object.keys(headers).length > 0 || Boolean(env.VERCEL_SHARE_TOKEN?.trim());
}

/** @deprecated alias */
export function getVerifyFetchHeaders(env = loadVerifyEnv()) {
  return getVercelProtectionHeaders(env);
}

/** @param {string} url */
export async function waitForHttpOk(url, timeoutMs = 60_000, extraHeaders = {}) {
  const start = Date.now();
  let lastError = '';
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: extraHeaders });
      if (res.ok || res.status === 304) return res;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

/** @param {Record<string, unknown>} manifest */
export function writeManifest(dir, manifest) {
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

/** @param {string} msg */
export function fail(msg) {
  console.error(`verify-perleap: ${msg}`);
  process.exit(1);
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i += 1;
      } else {
        out[key] = 'true';
      }
    }
  }
  return out;
}

/** Pin English before app scripts run. */
export const ENGLISH_INIT_SCRIPT = () => {
  localStorage.setItem('language_preference', 'en');
};
