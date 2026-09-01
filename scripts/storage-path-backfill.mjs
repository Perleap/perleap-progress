#!/usr/bin/env node
/**
 * Storage path normalization — dry-run report or staging-only apply.
 * Legacy signed/public URLs can be normalized to object paths (runtime compat handles display).
 *
 * Usage:
 *   node scripts/storage-path-backfill.mjs --dry-run --all
 *   node scripts/storage-path-backfill.mjs --dry-run --scope avatars,submissions
 *   node scripts/storage-path-backfill.mjs --apply --all --staging   # staging DB only
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(REPO_ROOT, 'scripts', 'reports');
/** perleap-staging Supabase project — apply mode refuses any other project */
const STAGING_PROJECT_REF = 'otjfoeyqiuerrgrdtgqx';

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
  const out = { dryRun: true, apply: false, staging: false, scopes: [], all: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--apply') {
      out.apply = true;
      out.dryRun = false;
    } else if (a === '--staging') out.staging = true;
    else if (a === '--all') out.all = true;
    else if (a === '--scope' && argv[i + 1]) out.scopes.push(...argv[++i].split(','));
  }
  if (out.all || out.scopes.length === 0) {
    out.scopes = ['avatars', 'submissions', 'materials', 'syllabus'];
  }
  return out;
}

function assertStagingOnly(env, args) {
  if (!args.apply) return;
  if (!args.staging) {
    console.error('--apply requires --staging (writes are limited to the staging Supabase project)');
    process.exit(1);
  }
  const url = env.VITE_SUPABASE_URL ?? '';
  if (!url.includes(STAGING_PROJECT_REF)) {
    console.error(
      `--apply refused: VITE_SUPABASE_URL must reference staging project ${STAGING_PROJECT_REF}`,
    );
    console.error(`Current URL: ${url || '(missing)'}`);
    process.exit(1);
  }
}

function parseMaterialsField(field) {
  const match = /^materials\[(\d+)\]\.file_path$/.exec(field);
  return match ? Number(match[1]) : null;
}

function parseFileUrlsField(field) {
  const match = /^file_urls\[(\d+)\]$/.exec(field);
  return match ? Number(match[1]) : null;
}

async function applyScalar(env, row) {
  const { table, id, field, after } = row;
  if (field === 'avatar_url') {
    await adminRest(env, `/${table}?user_id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ avatar_url: after }),
    });
    return;
  }
  if (field === 'file_url') {
    await adminRest(env, `/submissions?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ file_url: after }),
    });
    return;
  }
  if (field === 'url→file_path') {
    await adminRest(env, `/activity_list?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ file_path: after }),
    });
    return;
  }
  throw new Error(`Unsupported scalar field: ${table}.${field}`);
}

async function applySubmissionFileUrls(env, submissionId, updates) {
  const rows = await adminRest(env, `/submissions?id=eq.${submissionId}&select=id,file_urls`, {
    method: 'GET',
  });
  const current = rows?.[0];
  if (!current || !Array.isArray(current.file_urls)) {
    throw new Error(`submissions ${submissionId}: missing file_urls array`);
  }
  const next = [...current.file_urls];
  for (const { index, after } of updates) {
    if (index < 0 || index >= next.length) {
      throw new Error(`submissions ${submissionId}: file_urls[${index}] out of range`);
    }
    next[index] = after;
  }
  await adminRest(env, `/submissions?id=eq.${submissionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ file_urls: next }),
  });
}

async function applyMaterials(env, table, rowId, updates) {
  const rows = await adminRest(env, `/${table}?id=eq.${rowId}&select=id,materials`, {
    method: 'GET',
  });
  const current = rows?.[0];
  if (!current || !Array.isArray(current.materials)) {
    throw new Error(`${table} ${rowId}: missing materials array`);
  }
  const next = current.materials.map((mat) => ({ ...mat }));
  for (const { index, after } of updates) {
    if (index < 0 || index >= next.length) {
      throw new Error(`${table} ${rowId}: materials[${index}] out of range`);
    }
    const mat = next[index];
    if (!mat || mat.type === 'link') continue;
    mat.file_path = after;
    if (typeof mat.url === 'string' && mat.url.startsWith('http')) {
      delete mat.url;
    }
  }
  await adminRest(env, `/${table}?id=eq.${rowId}`, {
    method: 'PATCH',
    body: JSON.stringify({ materials: next }),
  });
}

async function applyCandidates(env, candidates) {
  const submissionFileUrlGroups = new Map();
  const materialsGroups = new Map();
  let applied = 0;

  for (const row of candidates) {
    const fileUrlsIndex = parseFileUrlsField(row.field);
    if (row.table === 'submissions' && fileUrlsIndex !== null) {
      const key = row.id;
      if (!submissionFileUrlGroups.has(key)) submissionFileUrlGroups.set(key, []);
      submissionFileUrlGroups.get(key).push({ index: fileUrlsIndex, after: row.after });
      continue;
    }

    const materialsIndex = parseMaterialsField(row.field);
    if ((row.table === 'classrooms' || row.table === 'assignments') && materialsIndex !== null) {
      const key = `${row.table}:${row.id}`;
      if (!materialsGroups.has(key)) {
        materialsGroups.set(key, { table: row.table, id: row.id, updates: [] });
      }
      materialsGroups.get(key).updates.push({ index: materialsIndex, after: row.after });
      continue;
    }

    await applyScalar(env, row);
    applied += 1;
    console.log(`  applied ${row.table} ${row.id} ${row.field}`);
  }

  for (const [submissionId, updates] of submissionFileUrlGroups) {
    await applySubmissionFileUrls(env, submissionId, updates);
    applied += updates.length;
    console.log(`  applied submissions ${submissionId} file_urls (${updates.length} slot(s))`);
  }

  for (const { table, id, updates } of materialsGroups.values()) {
    await applyMaterials(env, table, id, updates);
    applied += updates.length;
    console.log(`  applied ${table} ${id} materials (${updates.length} slot(s))`);
  }

  return applied;
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

async function collectCandidates(env, scopes) {
  const byScope = {};
  const all = [];
  for (const scope of scopes) {
    const scanner = SCANNERS[scope];
    if (!scanner) {
      console.warn(`Unknown scope: ${scope}`);
      continue;
    }
    const found = await scanner(env);
    byScope[scope] = found;
    all.push(...found);
    console.log(`${scope}: ${found.length} candidate(s)`);
  }
  return { byScope, all };
}

function writeReport(report, stamp) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const outPath = path.join(REPORTS_DIR, `storage-path-backfill-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  return outPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  if (!env.VITE_SUPABASE_URL) {
    console.error('VITE_SUPABASE_URL missing');
    process.exit(1);
  }
  assertStagingOnly(env, args);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const { byScope, all } = await collectCandidates(env, args.scopes);

  const report = {
    mode: args.apply ? 'apply' : 'dry-run',
    generatedAt: new Date().toISOString(),
    scopes: args.scopes,
    summary: Object.fromEntries(Object.entries(byScope).map(([k, v]) => [k, v.length])),
    samples: Object.fromEntries(Object.entries(byScope).map(([k, v]) => [k, v.slice(0, 5)])),
    totalCandidates: all.length,
  };

  if (args.apply) {
    if (all.length === 0) {
      console.log('\nApply skipped — no candidates to update.');
    } else {
      console.log(`\nApplying ${all.length} update(s) on staging…`);
      report.applied = await applyCandidates(env, all);
      console.log(`Applied ${report.applied} field update(s).`);
    }
  }

  const outPath = writeReport(report, stamp);

  if (args.apply) {
    console.log(`\nApply complete — report: ${outPath}`);
    if (all.length > 0) {
      console.log('Re-run with --dry-run to confirm zero remaining candidates.');
    }
  } else {
    console.log(`\nDry-run complete — ${report.totalCandidates} total candidate(s)`);
    console.log(`Report: ${outPath}`);
    console.log('No database writes were made.');
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
