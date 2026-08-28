import {
  loadVerifyEnv,
  fail,
} from './shared.mjs';

export function getServiceKey(env = loadVerifyEnv()) {
  const key = env.VITE_SUPABASE_SECRET_KEY;
  if (!key) {
    fail('VITE_SUPABASE_SECRET_KEY required in .env.local for sandbox seed and fetch abilities');
  }
  return key;
}

export function adminHeaders(env = loadVerifyEnv()) {
  const key = getServiceKey(env);
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

export async function adminRest(path, options = {}, env = loadVerifyEnv()) {
  const url = `${env.VITE_SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...adminHeaders(env),
      Prefer: options.prefer ?? 'return=representation',
      ...(options.headers ?? {}),
    },
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
    fail(`Admin REST ${options.method ?? 'GET'} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return body;
}

export async function listUsersByEmail(email, env = loadVerifyEnv()) {
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
  const user = payload.users?.find((u) => u.email?.toLowerCase() === normalized);
  if (!user) {
    fail(`No auth user found for email ${email}`);
  }
  return user;
}

export async function createSessionForEmail(email, env = loadVerifyEnv()) {
  const key = getServiceKey(env);
  const genRes = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: adminHeaders(env),
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  if (!genRes.ok) {
    fail(`generate_link failed for ${email}`);
  }
  const linkPayload = await genRes.json();
  const verifyRes = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      apikey: env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'email',
      email,
      token: linkPayload.email_otp,
    }),
  });
  if (!verifyRes.ok) {
    fail(`verify OTP failed for ${email}`);
  }
  return verifyRes.json();
}
