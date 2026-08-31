import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en/translation.json'), 'utf8'));

function hasKey(obj, keyPath) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) return false;
    cur = cur[p];
  }
  return typeof cur === 'string';
}

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(ent.name)) walk(p, files);
    } else if (/\.(tsx?|jsx?)$/.test(ent.name)) {
      files.push(p);
    }
  }
  return files;
}

const keys = new Set();
const re = /\bt\(\s*['"]([^'"]+)['"]/g;

for (const file of walk(path.join(root, 'src'))) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = re.exec(text))) {
    const k = m[1];
    if (k.includes('${')) continue;
    if (k.startsWith('dimensions.')) continue;
    keys.add(k);
  }
}

const missing = [...keys].filter((k) => !hasKey(en, k)).sort();
console.log(`Missing count: ${missing.length}`);
for (const k of missing) console.log(k);

// #region agent log
fetch('http://127.0.0.1:7500/ingest/ed854b70-ad07-4d4d-a108-a3423d664607',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bc2fb9'},body:JSON.stringify({sessionId:'bc2fb9',location:'scripts/check-i18n-keys.mjs:exit',message:'i18n check completed',data:{missingCount:missing.length,keysScanned:keys.size},timestamp:Date.now(),hypothesisId:'H1',runId:'post-fix'})}).catch(()=>{});
// #endregion

if (missing.length > 0) process.exit(1);
