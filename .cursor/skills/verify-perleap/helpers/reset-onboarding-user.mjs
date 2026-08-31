import { loadVerifyEnv, parseArgs, fail } from './shared.mjs';
import { adminRest } from './supabase-admin.mjs';
import { getOnboardingCredentials } from './ensure-onboarding-users.mjs';
import { listUsersByEmail } from './supabase-admin.mjs';

const args = parseArgs(process.argv.slice(2));
const kind = args.role?.replace(/^onboarding-/, '') ?? args.kind;

if (!kind || !['student', 'teacher'].includes(kind)) {
  fail('Usage: node reset-onboarding-user.mjs --role student|teacher');
}

async function main() {
  const env = loadVerifyEnv();
  const creds = getOnboardingCredentials(kind, env);
  const user = await listUsersByEmail(creds.email, env);
  const table = kind === 'student' ? 'student_profiles' : 'teacher_profiles';

  await adminRest(`/${table}?user_id=eq.${user.id}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });

  console.log(`verify-perleap onboarding: reset ${kind} profile for ${creds.email}`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
