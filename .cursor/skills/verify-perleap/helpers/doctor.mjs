import fs from 'fs';
import {
  RUN_STATE_FILE,
  authStatePath,
  loadVerifyEnv,
  loadSandboxFixture,
  ensureSkillDirs,
  waitForHttpOk,
  fail,
  parseArgs,
} from './shared.mjs';
import { adminRest } from './supabase-admin.mjs';

const args = parseArgs(process.argv.slice(2));
const role = args.role;
const env = loadVerifyEnv();
const baseURL = env.VERIFY_BASE_URL;
const port = Number(env.VERIFY_PORT);

/** @param {number} p */
async function isPortInUse(p) {
  const net = await import('net');
  return new Promise((resolve) => {
    const socket = net.default.createConnection({ port: p, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function main() {
  ensureSkillDirs();

  const missing = [];
  if (!env.VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!env.VITE_SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY');
  if (missing.length) {
    fail(`Missing env: ${missing.join(', ')} (check .env / .env.local)`);
  }

  const portOpen = await isPortInUse(port);
  if (!portOpen) {
    fail(`Nothing listening on ${baseURL}. Run: node .cursor/skills/verify-perleap/helpers/launch.mjs`);
  }

  const runState = fs.existsSync(RUN_STATE_FILE)
    ? JSON.parse(fs.readFileSync(RUN_STATE_FILE, 'utf8'))
    : null;

  if (port === 8080 && !runState?.pid) {
    fail(
      'Port 8080 is in use but not owned by verify-perleap (.run/server.json missing). Use VERIFY_PORT=8081 in .env.verify and launch the verify server.',
    );
  }

  if (runState?.pid) {
    try {
      process.kill(runState.pid, 0);
      console.log(`verify-perleap doctor: verify server pid ${runState.pid} on port ${port}`);
    } catch {
      fail(`Stale run state for pid ${runState.pid}. Run cleanup then launch again.`);
    }
  }

  await waitForHttpOk(`${baseURL}/auth`, 5_000);
  console.log(`verify-perleap doctor: ${baseURL}/auth OK`);
  console.log(`verify-perleap doctor: Supabase URL ${env.VITE_SUPABASE_URL}`);

  if (role) {
    const authPath = authStatePath(role);
    if (!fs.existsSync(authPath)) {
      fail(`Missing auth state for role "${role}" at ${authPath}. Run verify:login -- --role ${role}`);
    }
    console.log(`verify-perleap doctor: auth state for ${role} OK`);
  } else {
    if (!env.VERIFY_STUDENT_EMAIL) {
      console.warn('verify-perleap doctor: warn — VERIFY_STUDENT_EMAIL not set');
    }
    if (!env.VERIFY_TEACHER_EMAIL) {
      console.warn('verify-perleap doctor: warn — VERIFY_TEACHER_EMAIL not set');
    }
  }

  const fixture = loadSandboxFixture();
  if (!fixture?.classroomId) {
    console.warn('verify-perleap doctor: warn — fixtures/sandbox.json missing. Run: npm run verify:seed');
  } else {
    const classrooms = await adminRest(
      `/classrooms?id=eq.${fixture.classroomId}&select=id,name&limit=1`,
      { method: 'GET' },
      env,
    );
    const assignments = await adminRest(
      `/assignments?id=eq.${fixture.chatAssignmentId}&select=id,title,status&limit=1`,
      { method: 'GET' },
      env,
    );
    const extraIds = [
      fixture.essayAssignmentId,
      fixture.mcqAssignmentId,
      fixture.testAssignmentId,
    ].filter(Boolean);
    for (const id of extraIds) {
      const rows = await adminRest(
        `/assignments?id=eq.${id}&select=id,title&limit=1`,
        { method: 'GET' },
        env,
      );
      if (!rows?.length) {
        console.warn(`verify-perleap doctor: warn — assignment ${id} missing. Run: npm run verify:seed`);
      }
    }
    const enrollments = await adminRest(
      `/enrollments?classroom_id=eq.${fixture.classroomId}&student_id=eq.${fixture.studentUserId}&active=eq.true&select=id&limit=1`,
      { method: 'GET' },
      env,
    );
    if (!classrooms?.length || !assignments?.length || !enrollments?.length) {
      fail('Sandbox fixture stale — re-run npm run verify:seed');
    }
    console.log(`verify-perleap doctor: sandbox OK (${classrooms[0].name}, ${assignments[0].title})`);
  }

  console.log('verify-perleap doctor: OK');
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
