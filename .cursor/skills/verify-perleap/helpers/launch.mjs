import fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import net from 'net';
import {
  REPO_ROOT,
  RUN_STATE_FILE,
  loadVerifyEnv,
  isRemoteVerifyTarget,
  ensureSkillDirs,
  waitForHttpOk,
  fail,
  parseArgs,
} from './shared.mjs';

/** @param {number} port */
function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

function readRunState() {
  if (!fs.existsSync(RUN_STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(RUN_STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeRunState(state) {
  ensureSkillDirs();
  fs.writeFileSync(RUN_STATE_FILE, JSON.stringify(state, null, 2));
}

const args = parseArgs(process.argv.slice(2));
const env = loadVerifyEnv();
const port = Number(env.VERIFY_PORT);
const baseURL = env.VERIFY_BASE_URL;

async function launch() {
  ensureSkillDirs();
  if (isRemoteVerifyTarget(baseURL)) {
    console.log(`verify-perleap: remote target ${baseURL} — skipping local dev server`);
    await waitForHttpOk(`${baseURL}/auth`, 30_000);
    return;
  }
  const existing = readRunState();
  if (existing?.pid && existing.port === port) {
    try {
      process.kill(existing.pid, 0);
      console.log(`verify-perleap: verify server already running (pid ${existing.pid}, port ${port})`);
      await waitForHttpOk(`${baseURL}/auth`);
      return;
    } catch {
      fs.unlinkSync(RUN_STATE_FILE);
    }
  }

  if (await isPortOpen(port)) {
    fail(
      `Port ${port} is in use by a non-verify process. Stop it or set VERIFY_PORT in .env.verify.`,
    );
  }

  const child = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--strictPort'], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: 'ignore',
    detached: true,
    shell: true,
  });
  child.unref();

  writeRunState({
    pid: child.pid,
    port,
    baseURL,
    startedAt: new Date().toISOString(),
  });

  console.log(`verify-perleap: started dev server pid=${child.pid} port=${port}`);
  await waitForHttpOk(`${baseURL}/auth`);
  console.log(`verify-perleap: ready at ${baseURL}`);
}

function killVerifyProcess(pid) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', shell: true });
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    process.kill(pid);
  }
}

async function cleanup() {
  const state = readRunState();
  if (!state?.pid) {
    console.log('verify-perleap: no verify server state to clean up');
    return;
  }
  try {
    killVerifyProcess(state.pid);
    console.log(`verify-perleap: stopped verify server pid=${state.pid}`);
  } catch (err) {
    console.warn(`verify-perleap: could not stop pid ${state.pid}:`, err);
  }
  if (fs.existsSync(RUN_STATE_FILE)) fs.unlinkSync(RUN_STATE_FILE);
}

const command = process.argv[2];
if (command === 'cleanup') {
  await cleanup();
} else {
  await launch();
}
