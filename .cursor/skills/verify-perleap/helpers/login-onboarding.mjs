import { chromium } from 'playwright';
import {
  authStatePath,
  loadVerifyEnv,
  ensureSkillDirs,
  fail,
  parseArgs,
  getBrowserLaunchOptions,
  getVercelProtectionHeaders,
  getVercelShareUrl,
  isRemoteVerifyTarget,
  shouldKeepBrowserOpen,
  navigationWaitUntil,
  ENGLISH_INIT_SCRIPT,
} from './shared.mjs';
import { getOnboardingCredentials } from './ensure-onboarding-users.mjs';

const AUTH_STORAGE_KEY = 'perleap-auth';

const args = parseArgs(process.argv.slice(2));
const kind = args.role;

if (!kind || !['student', 'teacher'].includes(kind)) {
  fail('Usage: node login-onboarding.mjs --role student|teacher');
}

const env = loadVerifyEnv();
const creds = getOnboardingCredentials(kind, env);
const email = creds.email;
const password = creds.password;
const authMode = env.VERIFY_AUTH_MODE ?? 'auto';
const authRole = `onboarding-${kind}`;

if (!email) {
  fail(`Onboarding ${kind} email missing. Run: npm run verify:seed-onboarding`);
}

const baseURL = env.VERIFY_BASE_URL;
const dashboardPath = kind === 'student' ? '/student/dashboard' : '/teacher/dashboard';
const onboardingPath = `/onboarding/${kind}`;

const landingMatcher = (url) =>
  url.pathname === dashboardPath ||
  url.pathname === onboardingPath ||
  url.pathname === '/role-selection';

async function fillAuthInput(page, selector, value) {
  const input = page.locator(selector);
  await input.click();
  await input.evaluate((el) => el.removeAttribute('readonly'));
  await input.fill(value);
}

async function passwordValid(emailAddr, pass) {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: emailAddr, password: pass }),
  });
  return res.ok;
}

async function createSessionViaMagicLink(emailAddr) {
  const serviceKey = env.VITE_SUPABASE_SECRET_KEY;
  if (!serviceKey) {
    fail('Magic link login needs VITE_SUPABASE_SECRET_KEY in .env.local');
  }

  const genRes = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email: emailAddr }),
  });

  if (!genRes.ok) {
    const body = await genRes.text();
    fail(`Magic link generation failed (${genRes.status}): ${body.slice(0, 200)}`);
  }

  const linkPayload = await genRes.json();
  if (!linkPayload.email_otp) {
    fail('Magic link response missing email_otp');
  }

  const verifyRes = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      apikey: env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'email',
      email: emailAddr,
      token: linkPayload.email_otp,
    }),
  });

  if (!verifyRes.ok) {
    const body = await verifyRes.text();
    fail(`Session verify failed (${verifyRes.status}): ${body.slice(0, 200)}`);
  }

  return verifyRes.json();
}

async function resolveAuthMethod() {
  if (authMode === 'magiclink') return 'magiclink';
  if (authMode === 'password') return 'password';
  if (password && (await passwordValid(email, password))) return 'password';
  if (env.VITE_SUPABASE_SECRET_KEY) return 'magiclink';
  fail(
    'Onboarding password login failed and no VITE_SUPABASE_SECRET_KEY for magic link. Run npm run verify:seed-onboarding or set VERIFY_ONBOARDING_* credentials.',
  );
}

async function loginWithPassword(page) {
  await page.goto(`${baseURL}/auth`, { waitUntil: navigationWaitUntil(env) });
  await page.getByRole('heading', { name: 'Sign in with email' }).waitFor({ timeout: 30_000 });
  await fillAuthInput(page, '#signin-email', email);
  await fillAuthInput(page, '#signin-password', password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
}

async function loginWithMagicLink(page) {
  const session = await createSessionViaMagicLink(email);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: AUTH_STORAGE_KEY, value: session },
  );
  await page.goto(`${baseURL}${onboardingPath}`, { waitUntil: navigationWaitUntil(env) });
}

async function main() {
  ensureSkillDirs();
  const method = await resolveAuthMethod();
  console.log(`verify-perleap: logging in onboarding ${kind} via ${method}`);

  const browser = await chromium.launch(getBrowserLaunchOptions(env));
  const protectionHeaders = getVercelProtectionHeaders(env);
  const context = await browser.newContext({
    locale: 'en-US',
    ...(Object.keys(protectionHeaders).length ? { extraHTTPHeaders: protectionHeaders } : {}),
  });
  await context.addInitScript(ENGLISH_INIT_SCRIPT);
  const page = await context.newPage();
  if (env.VERCEL_SHARE_TOKEN?.trim() && isRemoteVerifyTarget(baseURL)) {
    const shareUrl = getVercelShareUrl(baseURL, env.VERCEL_SHARE_TOKEN);
    if (shareUrl) await page.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  }

  if (method === 'password') {
    await loginWithPassword(page);
  } else {
    await loginWithMagicLink(page);
  }

  try {
    await page.waitForURL(landingMatcher, { timeout: 90_000 });
  } catch {
    const debugPath = authStatePath(`${authRole}-login-failure`);
    await page.screenshot({ path: `${debugPath}.png`, fullPage: true });
    const snippet = (await page.locator('body').innerText()).slice(0, 400);
    fail(`Onboarding login failed. URL=${page.url()} body=${snippet.replace(/\s+/g, ' ')}`);
  }

  const pathname = new URL(page.url()).pathname;
  if (pathname === '/role-selection') {
    fail(`Onboarding account ${email} has no role metadata.`);
  }
  if (pathname !== onboardingPath && pathname !== dashboardPath) {
    fail(`Onboarding login expected ${onboardingPath} or ${dashboardPath}, got ${pathname}`);
  }

  const outPath = authStatePath(authRole);
  await context.storageState({ path: outPath });
  if (!shouldKeepBrowserOpen(env)) {
    await browser.close();
  } else {
    console.log('verify-perleap: VERIFY_KEEP_OPEN=1 — browser left open after onboarding login');
  }

  console.log(`verify-perleap: saved ${authRole} auth state → ${outPath}`);
  console.log(`verify-perleap: landed on ${pathname}`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
