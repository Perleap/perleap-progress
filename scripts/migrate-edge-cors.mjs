/**
 * Migrate edge functions from wildcard corsHeaders to shared _shared/cors.ts helpers.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const functionsDir = join(__dirname, '..', 'supabase', 'functions');
const CORS_IMPORT = "import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';";

const PERLEAP_CHAT_EXPOSE =
  "'Access-Control-Expose-Headers': 'X-Perleap-Prior-N, X-Perleap-Prior-Parts, X-Perleap-Prior-Parts-Pre, X-Perleap-Prior-Verbatim, X-Perleap-Prior-Summary, X-Perleap-Prior-Section-Len, X-Perleap-Prior-Section-Db, X-Perleap-Prior-Client, X-Perleap-Unit-Memory-Facts, X-Perleap-Course-Memory-Facts'";

function listFunctionIndexFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    const indexPath = join(full, 'index.ts');
    try {
      readFileSync(indexPath);
      out.push(indexPath);
    } catch {
      // skip
    }
  }
  return out.sort();
}

function migrateFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  if (!content.includes('Access-Control-Allow-Origin')) return false;
  if (content.includes("from '../_shared/cors.ts'") && content.includes('getCorsHeaders(req')) {
    return false;
  }

  const isPerleapChat = filePath.replace(/\\/g, '/').includes('/perleap-chat/index.ts');

  if (!content.includes(CORS_IMPORT)) {
    const lastImport = content.lastIndexOf('\nimport ');
    const insertAt = content.indexOf('\n', lastImport) + 1;
    content = content.slice(0, insertAt) + CORS_IMPORT + '\n' + content.slice(insertAt);
  }

  content = content.replace(
    /\r?\nconst corsHeaders = \{[\s\S]*?\};\r?\n/,
    '\n',
  );

  const optionsReplacement = isPerleapChat
    ? `if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req, corsExtra);
  }

  const corsExtra = {
    ${PERLEAP_CHAT_EXPOSE},
  };
  const corsHeaders = getCorsHeaders(req, corsExtra);`
    : `if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req);
  }

  const corsHeaders = getCorsHeaders(req);`;

  const patched = content.replace(
    /if \(req\.method === 'OPTIONS'\) \{\s*\r?\n\s*return new Response\(null, \{ headers: corsHeaders \}\);\s*\r?\n\s*\}/,
    optionsReplacement,
  );

  if (patched === content) {
    console.warn(`WARN: OPTIONS block not found in ${filePath}`);
    return false;
  }

  writeFileSync(filePath, patched);
  return true;
}

let updated = 0;
for (const file of listFunctionIndexFiles(functionsDir)) {
  if (migrateFile(file)) {
    console.log('Updated', file);
    updated += 1;
  }
}
console.log(`Done. Updated ${updated} edge functions.`);
