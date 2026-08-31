import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadVerifyEnv,
  fail,
  FIXTURE_DIR,
  ensureSkillDirs,
} from './shared.mjs';
import { adminHeaders, getServiceKey } from './supabase-admin.mjs';

const ONBOARDING_FIXTURE_FILE = path.join(FIXTURE_DIR, 'onboarding.json');
const DEFAULT_PASSWORD = 'VerifyOnboarding1!';

function projectSlug(env) {
  try {
    const host = new URL(env.VITE_SUPABASE_URL).hostname;
    return host.split('.')[0] ?? 'perleap';
  } catch {
    return 'perleap';
  }
}

function defaultOnboardingEmail(kind, env) {
  return `perleap.verify.${kind}.onboarding+${projectSlug(env)}@verify.perleap.test`;
}

async function findUserByEmail(email, env) {
  const key = getServiceKey(env);
  const res = await fetch(
    `${env.VITE_SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) {
    fail(`Admin list users failed (${res.status})`);
  }
  const payload = await res.json();
  const normalized = email.toLowerCase().trim();
  return payload.users?.find((u) => u.email?.toLowerCase() === normalized) ?? null;
}

async function createAuthUser(email, password, role, env) {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(env),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role },
    }),
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    fail(`Create auth user ${email} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return body?.user ?? body;
}

async function ensureUser(kind, env) {
  const role = kind === 'student' ? 'student' : 'teacher';
  const emailKey = `VERIFY_ONBOARDING_${kind.toUpperCase()}_EMAIL`;
  const passwordKey = `VERIFY_ONBOARDING_${kind.toUpperCase()}_PASSWORD`;
  const email = env[emailKey]?.trim() || defaultOnboardingEmail(kind, env);
  const password = env[passwordKey]?.trim() || DEFAULT_PASSWORD;

  let user = await findUserByEmail(email, env);
  if (!user) {
    user = await createAuthUser(email, password, role, env);
    console.log(`verify-perleap onboarding: created ${role} user ${email}`);
  } else {
    console.log(`verify-perleap onboarding: reusing ${role} user ${email}`);
  }

  return { kind, role, email, password, userId: user.id };
}

export function loadOnboardingFixture() {
  if (!fs.existsSync(ONBOARDING_FIXTURE_FILE)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(ONBOARDING_FIXTURE_FILE, 'utf8'));
}

export function getOnboardingCredentials(kind, env = loadVerifyEnv()) {
  const fixture = loadOnboardingFixture();
  const entry = fixture?.[kind];
  if (entry?.email && entry?.password) {
    return entry;
  }
  const emailKey = `VERIFY_ONBOARDING_${kind.toUpperCase()}_EMAIL`;
  const passwordKey = `VERIFY_ONBOARDING_${kind.toUpperCase()}_PASSWORD`;
  return {
    email: env[emailKey]?.trim() || defaultOnboardingEmail(kind, env),
    password: env[passwordKey]?.trim() || DEFAULT_PASSWORD,
  };
}

async function main() {
  ensureSkillDirs();
  const env = loadVerifyEnv();
  const student = await ensureUser('student', env);
  const teacher = await ensureUser('teacher', env);

  const fixture = {
    student: {
      email: student.email,
      password: student.password,
      userId: student.userId,
    },
    teacher: {
      email: teacher.email,
      password: teacher.password,
      userId: teacher.userId,
    },
    seededAt: new Date().toISOString(),
  };

  fs.writeFileSync(ONBOARDING_FIXTURE_FILE, JSON.stringify(fixture, null, 2));
  console.log('verify-perleap onboarding: wrote fixtures/onboarding.json');
  console.log(`  student=${fixture.student.email}`);
  console.log(`  teacher=${fixture.teacher.email}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
}
