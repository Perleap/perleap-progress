import { chromium } from 'playwright';
import {
  authStatePath,
  getBrowserLaunchOptions,
  getVercelProtectionHeaders,
  getVercelShareUrl,
  isRemoteVerifyTarget,
  shouldKeepBrowserOpen,
  ENGLISH_INIT_SCRIPT,
  fail,
} from '../helpers/shared.mjs';

async function ensureVercelShareCookies(page, env) {
  const token = env.VERCEL_SHARE_TOKEN?.trim();
  if (!token || !isRemoteVerifyTarget(env.VERIFY_BASE_URL)) return;
  const shareUrl = getVercelShareUrl(env.VERIFY_BASE_URL, token);
  if (!shareUrl) return;
  await page.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
}

/** @param {{ role: 'student' | 'teacher' | 'admin' | 'anonymous', env: import('../helpers/shared.mjs').loadVerifyEnv extends () => infer R ? R : never }} opts */
export async function openBrowserContext({ role, env }) {
  const browser = await chromium.launch(getBrowserLaunchOptions(env));
  const protectionHeaders = getVercelProtectionHeaders(env);
  const contextOptions = {
    locale: 'en-US',
    ...(Object.keys(protectionHeaders).length ? { extraHTTPHeaders: protectionHeaders } : {}),
  };
  if (role !== 'anonymous') {
    contextOptions.storageState = authStatePath(role);
  }
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(ENGLISH_INIT_SCRIPT);
  const page = await context.newPage();
  await ensureVercelShareCookies(page, env);
  return { browser, context, page };
}

export async function closeBrowserContext({ browser, env }) {
  if (shouldKeepBrowserOpen(env)) {
    console.log('verify-perleap: VERIFY_KEEP_OPEN=1 — browser left open for inspection');
    return;
  }
  try {
    await browser.close();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`verify-perleap: browser close skipped (${msg})`);
  }
}

export function requireFixture(fixture) {
  if (!fixture?.chatAssignmentId) {
    fail('fixtures/sandbox.json missing. Run: npm run verify:seed');
  }
  return fixture;
}
