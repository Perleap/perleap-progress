#!/usr/bin/env node
/**
 * Deploy every edge function that has an index.ts (skips shared helper folders).
 * Cross-platform replacement for deploy-all-edge-functions.sh on Windows.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const functionsDir = join(root, 'supabase', 'functions');
const skip = new Set(['_shared', 'shared']);

const names = readdirSync(functionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !skip.has(entry.name))
  .map((entry) => entry.name)
  .filter((name) => existsSync(join(functionsDir, name, 'index.ts')))
  .sort();

for (const name of names) {
  console.log(`Deploying edge function: ${name}`);
  const result = spawnSync('npx', ['supabase', 'functions', 'deploy', name], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('All edge functions deployed.');
