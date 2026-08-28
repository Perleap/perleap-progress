import { chromium } from 'playwright';
import {
  authStatePath,
  getBrowserLaunchOptions,
  shouldKeepBrowserOpen,
  ENGLISH_INIT_SCRIPT,
  fail,
} from '../helpers/shared.mjs';

/** @param {{ role: 'student' | 'teacher' | 'admin' | 'anonymous', env: import('../helpers/shared.mjs').loadVerifyEnv extends () => infer R ? R : never }} opts */
export async function openBrowserContext({ role, env }) {
  const browser = await chromium.launch(getBrowserLaunchOptions(env));
  const contextOptions = { locale: 'en-US' };
  if (role !== 'anonymous') {
    contextOptions.storageState = authStatePath(role);
  }
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(ENGLISH_INIT_SCRIPT);
  const page = await context.newPage();
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
