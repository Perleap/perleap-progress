/**
 * Validates CORS allowlist config and absence of wildcard ACAO in edge functions.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const functionsDir = join(__dirname, '..', 'supabase', 'functions');
const corsModule = readFileSync(join(functionsDir, '_shared', 'cors.ts'), 'utf8');

let failed = false;

if (!corsModule.includes('https://perleap.ai')) {
  console.error('FAIL: cors.ts missing https://perleap.ai default');
  failed = true;
} else {
  console.log('OK: cors.ts includes perleap.ai');
}

if (!corsModule.includes('https://staging.perleap.ai')) {
  console.error('FAIL: cors.ts missing staging default');
  failed = true;
} else {
  console.log('OK: cors.ts includes staging.perleap.ai');
}

const vercel = JSON.parse(readFileSync(join(__dirname, '..', 'vercel.json'), 'utf8'));
const headerKeys = vercel.headers?.[0]?.headers?.map((h) => h.key) ?? [];
for (const key of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Content-Security-Policy-Report-Only']) {
  if (!headerKeys.includes(key)) {
    console.error(`FAIL: vercel.json missing ${key}`);
    failed = true;
  } else {
    console.log(`OK: vercel.json has ${key}`);
  }
}

function listIndexFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    const indexPath = join(full, 'index.ts');
    try {
      readFileSync(indexPath, 'utf8');
      out.push(indexPath);
    } catch {
      // skip directories without index.ts
    }
  }
  return out;
}

let wildcardCount = 0;
for (const file of listIndexFiles(functionsDir)) {
  const content = readFileSync(file, 'utf8');
  if (content.includes("'Access-Control-Allow-Origin': '*'")) {
    console.error(`FAIL: wildcard CORS still in ${file}`);
    wildcardCount += 1;
    failed = true;
  }
}
if (wildcardCount === 0) {
  console.log('OK: no wildcard Access-Control-Allow-Origin in edge functions');
}

if (failed) process.exit(1);
console.log('CORS config QA passed');
