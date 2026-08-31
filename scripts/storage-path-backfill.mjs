#!/usr/bin/env node
/**
 * Dry-run storage path normalization report.
 * Does NOT write to the database — lists rows where legacy signed/public URLs
 * could be normalized to object paths (runtime compat already handles display).
 *
 * Usage:
 *   node scripts/storage-path-backfill.mjs --dry-run --all
 *   node scripts/storage-path-backfill.mjs --dry-run --scope avatars,submissions
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(REPO_ROOT, 'scripts', 'reports');

const BUCKETS = {
  submissions: 'submission-files',
  studentAvatars: 'student-avatars',
  teacherAvatars: 'teacher-avatars',
  courseMaterials: 'course-materials',
  assignmentMaterials: 'assignment-materials',
  syllabus: 'syllabus-resources',
};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnv() {
  return {
    ...parseEnvFile(path.join(REPO_ROOT, '.env')),
    ...parseEnvFile(path.join(REPO_ROOT, '.env.local')),
    ...process.env,
  };
}

function extractPath(bucket, stored) {
  if (!stored || typeof stored !== 'string') return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return null;
  }
  const publicMarker = `/storage/v1/object/public/${bucket}/`;
  const signMarker = `/storage/v1/object/sign/${bucket}/`;
  const marker = trimmed.includes(publicMarker)
    ? publicMarker
    : trimmed.includes(signMarker)
      ? signMarker
      : null;
  if (!marker) return null;
  const idx = trimmed.indexOf(marker);
  return decodeURIComponent(trimmed.slice(idx + marker.length).split('?')[0] ?? '');
}

function inferAvatarBucket(value) {
  if (value.includes(`/${BUCKETS.studentAvatars}/`)) return BUCKETS.studentAvatars;
  if (value.includes(`/${BUCKETS.teacherAvatars}/`)) return BUCKETS.teacherAvatars;
  return BUCKETS.studentAvatars;
}

function adminHeaders(env) {
  const key = env.VITE_SUPABASE_SECRET_KEY;
  if (!key) {
    console.error('VITE_SUPABASE_SECRET_KEY required in .env.local');
    process.exit(1);
  }
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function adminRest(env, restPath, options = {}) {
  const url = `${env.VITE_SUPABASE_URL}/rest/v1${restPath}`;
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
    throw new Error(`Admin REST ${options.method ?? 'GET'} ${restPath} (${res.status}): ${text.slice(0, 200)}`);
  }
  return body;
}

function parseArgs(argv) {
  const out = { dryRun: true, scopes: [], all: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--all') out.all = true;
    else if (a === '--scope' && argv[i + 1]) out.scopes.push(...argv[++i].split(','));
  }
  if (out.all || out.scopes.length === 0) {
    out.scopes = ['avatars', 'submissions', 'materials', 'syllabus'];
  }
  return out;
}

async function scanAvatars(env) {
  const rows = [];
  for (const [table, defaultBucket] of [
    ['student_profiles', BUCKETS.studentAvatars],
    ['teacher_profiles', BUCKETS.teacherAvatars],
  ]) {
    const data = await adminRest(
      env,
      `/${table}?avatar_url=like.http*&select=user_id,avatar_url&limit=500`,
      { method: 'GET' },
    );
    for (const row of data ?? []) {
      const bucket = inferAvatarBucket(row.avatar_url);
      const after = extractPath(bucket, row.avatar_url) ?? extractPath(defaultBucket, row.avatar_url);
      if (after && after !== row.avatar_url) {
        rows.push({
          table,
          id: row.user_id,
          field: 'avatar_url',
          before: row.avatar_url,
          after,
        });
      }
    }
  }
  return rows;
}

async function scanSubmissions(env) {
  const rows = [];
  const data = await adminRest(
    env,
    `/submissions?or=(file_url.like.http*,file_urls.not.is.null)&select=id,file_url,file_urls&limit=500`,
    { method: 'GET' },
  );
  for (const row of data ?? []) {
    if (row.file_url?.startsWith('http')) {
      const after = extractPath(BUCKETS.submissions, row.file_url);
      if (after) {
        rows.push({ table: 'submissions', id: row.id, field: 'file_url', before: row.file_url, after });
      }
    }
    if (Array.isArray(row.file_urls)) {
      row.file_urls.forEach((url, index) => {
        if (typeof url === 'string' && url.startsWith('http')) {
          const after = extractPath(BUCKETS.submissions, url);
          if (after) {
            rows.push({
              table: 'submissions',
              id: row.id,
              field: `file_urls[${index}]`,
              before: url,
              after,
            });
          }
        }
      });
    }
  }
  return rows;
}

function scanMaterialsArray(materials, bucket, table, rowId) {
  const rows = [];
  if (!Array.isArray(materials)) return rows;
  materials.forEach((mat, index) => {
    if (!mat || mat.type === 'link') return;
    const url = mat.url?.trim();
    if (!url?.startsWith('http')) return;
    if (mat.file_path?.trim()) return;
    const after = extractPath(bucket, url);
    if (after) {
      rows.push({
        table,
        id: rowId,
        field: `materials[${index}].file_path`,
        before: url,
        after,
      });
    }
  });
  return rows;
}

async function scanMaterials(env) {
  const rows = [];
  const classrooms = await adminRest(
    env,
    `/classrooms?materials=not.is.null&select=id,materials&limit=200`,
    { method: 'GET' },
  );
  for (const row of classrooms ?? []) {
    rows.push(...scanMaterialsArray(row.materials, BUCKETS.courseMaterials, 'classrooms', row.id));
  }
  const assignments = await adminRest(
    env,
    `/assignments?materials=not.is.null&select=id,materials&limit=500`,
    { method: 'GET' },
  );
  for (const row of assignments ?? []) {
    rows.push(
      ...scanMaterialsArray(row.materials, BUCKETS.assignmentMaterials, 'assignments', row.id),
    );
  }
  return rows;
}

async function scanSyllabus(env) {
  const rows = [];
  const data = await adminRest(
    env,
    `/activity_list?url=like.http*&select=id,url&limit=500`,
    { method: 'GET' },
  );
  for (const row of data ?? []) {
    const after = extractPath(BUCKETS.syllabus, row.url);
    if (after) {
      rows.push({ table: 'activity_list', id: row.id, field: 'url→file_path', before: row.url, after });
    }
  }
  return rows;
}

const SCANNERS = {
  avatars: scanAvatars,
  submissions: scanSubmissions,
  materials: scanMaterials,
  syllabus: scanSyllabus,
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  if (!env.VITE_SUPABASE_URL) {
    console.error('VITE_SUPABASE_URL missing');
    process.exit(1);
  }

  const report = {
    mode: 'dry-run',
    generatedAt: new Date().toISOString(),
    scopes: args.scopes,
    summary: {},
    samples: {},
    totalCandidates: 0,
  };

  for (const scope of args.scopes) {
    const scanner = SCANNERS[scope];
    if (!scanner) {
      console.warn(`Unknown scope: ${scope}`);
      continue;
    }
    const found = await scanner(env);
    report.summary[scope] = found.length;
    report.samples[scope] = found.slice(0, 5);
    report.totalCandidates += found.length;
    console.log(`${scope}: ${found.length} candidate(s)`);
  }

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.join(REPORTS_DIR, `storage-path-backfill-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`\nDry-run complete — ${report.totalCandidates} total candidate(s)`);
  console.log(`Report: ${outPath}`);
  console.log('No database writes were made.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
