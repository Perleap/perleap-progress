/**
 * Writes Supabase generated types to src/integrations/supabase/types.ts using only CLI stdout
 * (avoids shell redirects that can corrupt the file on Windows).
 *
 * Override project: SUPABASE_PROJECT_ID=ref npm run gen:types
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function readProjectId() {
  const fromEnv = process.env.SUPABASE_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;

  const configPath = join(root, 'supabase', 'config.toml');
  const raw = readFileSync(configPath, 'utf8');
  const m = raw.match(/^\s*project_id\s*=\s*"([^"]+)"/m);
  if (!m) {
    throw new Error('Set SUPABASE_PROJECT_ID or add project_id to supabase/config.toml');
  }
  return m[1];
}

function supabaseExecutable() {
  const binDir = join(root, 'node_modules', 'supabase', 'bin');
  if (process.platform === 'win32') {
    const exe = join(binDir, 'supabase.exe');
    if (!existsSync(exe)) {
      throw new Error(`Missing ${exe}. Run npm install.`);
    }
    return exe;
  }
  const unixBin = join(binDir, 'supabase');
  if (existsSync(unixBin)) return unixBin;
  const exe = join(binDir, 'supabase.exe');
  if (existsSync(exe)) return exe;
  throw new Error('supabase CLI binary not found under node_modules/supabase/bin');
}

const projectId = readProjectId();
const exe = supabaseExecutable();
const outPath = join(root, 'src', 'integrations', 'supabase', 'types.ts');

const result = spawnSync(
  exe,
  ['gen', 'types', 'typescript', '--project-id', projectId, '--schema', 'public'],
  {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);

if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  console.error(`supabase exited with code ${result.status}`);
  process.exit(result.status ?? 1);
}

const stdout = result.stdout ?? '';
if (!stdout.includes('export type Database')) {
  console.error('Output does not look like Supabase TypeScript types (missing "export type Database").');
  process.exit(1);
}

writeFileSync(outPath, stdout, 'utf8');
console.log(`Wrote ${outPath}`);
