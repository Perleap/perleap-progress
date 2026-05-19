/**
 * Process completed submissions missing a unit-memory marker (no backfill UI).
 *
 * Prerequisites:
 *   - Deploy updated edge functions: extract-unit-memory (merge/idempotency fix)
 *   - .env with VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
 *   - Optional: PERLEAP_UNIT_MEMORY_MAX_FACTS=30 on Supabase for very full units
 *
 * Usage:
 *   npm run extract:unit-memory-outliers
 *   npm run extract:unit-memory-outliers -- --dry-run
 *   npm run extract:unit-memory-outliers -- --limit=10
 *   npm run extract:unit-memory-outliers -- --submission-id=<uuid>
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvFile() {
  const path = join(root, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
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
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const opts = { dryRun: false, limit: Infinity, submissionId: '' };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--limit=')) {
      const n = parseInt(arg.slice('--limit='.length), 10);
      if (Number.isFinite(n) && n > 0) opts.limit = n;
    } else if (arg.startsWith('--submission-id=')) {
      opts.submissionId = arg.slice('--submission-id='.length).trim();
    }
  }
  return opts;
}

function submissionMarkerKey(studentId, classroomId, sectionId, submissionId) {
  return `${studentId}|${classroomId}|${sectionId}|${submissionId}`;
}

loadEnvFile();

const supabaseUrl = (
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  ''
).replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env',
  );
  process.exit(1);
}

const opts = parseArgs(process.argv.slice(2));

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function listOutliers() {
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  const subsUrl = new URL(`${supabaseUrl}/rest/v1/submissions`);
  subsUrl.searchParams.set(
    'select',
    'id,student_id,submitted_at,assignment_id,assignments!inner(id,title,type,classroom_id,syllabus_section_id)',
  );
  subsUrl.searchParams.set('status', 'eq.completed');
  subsUrl.searchParams.set('is_teacher_attempt', 'eq.false');
  subsUrl.searchParams.set('assignments.classroom_id', 'not.is.null');
  subsUrl.searchParams.set('assignments.syllabus_section_id', 'not.is.null');
  subsUrl.searchParams.set('order', 'submitted_at.asc');

  const { ok, data } = await fetchJson(subsUrl, { headers });
  if (!ok) {
    throw new Error(`Failed to load submissions: ${JSON.stringify(data)}`);
  }

  const [memRes, courseRes] = await Promise.all([
    fetchJson(
      new URL(
        `${supabaseUrl}/rest/v1/student_section_unit_memory?select=student_id,classroom_id,syllabus_section_id,facts`,
      ),
      { headers },
    ),
    fetchJson(
      new URL(
        `${supabaseUrl}/rest/v1/student_classroom_course_memory?select=student_id,classroom_id,facts,processed_submission_ids`,
      ),
      { headers },
    ),
  ]);

  if (!memRes.ok) {
    throw new Error(`Failed to load unit memory: ${JSON.stringify(memRes.data)}`);
  }
  if (!courseRes.ok) {
    throw new Error(`Failed to load course memory: ${JSON.stringify(courseRes.data)}`);
  }

  const sectionMarkers = new Set();
  const factsCountByUnit = new Map();
  const courseProcessedByStudentClassroom = new Map();
  const courseFactsCount = new Map();

  for (const row of memRes.data ?? []) {
    const unitKey = `${row.student_id}|${row.classroom_id}|${row.syllabus_section_id}`;
    const facts = Array.isArray(row.facts) ? row.facts : [];
    factsCountByUnit.set(unitKey, facts.length);
    for (const f of facts) {
      const sid = typeof f?.submission_id === 'string' ? f.submission_id : '';
      if (!sid) continue;
      sectionMarkers.add(
        submissionMarkerKey(row.student_id, row.classroom_id, row.syllabus_section_id, sid),
      );
    }
  }

  for (const row of courseRes.data ?? []) {
    const courseKey = `${row.student_id}|${row.classroom_id}`;
    const facts = Array.isArray(row.facts) ? row.facts : [];
    courseFactsCount.set(courseKey, facts.length);
    const processed = new Set();
    for (const id of Array.isArray(row.processed_submission_ids)
      ? row.processed_submission_ids
      : []) {
      if (typeof id === 'string' && id.trim()) processed.add(id.trim());
    }
    courseProcessedByStudentClassroom.set(courseKey, processed);
  }

  const outliers = [];
  for (const row of data ?? []) {
    const a = row.assignments;
    if (!a?.classroom_id || !a?.syllabus_section_id) continue;

    const courseKey = `${row.student_id}|${a.classroom_id}`;
    const processed = courseProcessedByStudentClassroom.get(courseKey) ?? new Set();
    if (processed.has(row.id)) continue;

    const unitKey = `${row.student_id}|${a.classroom_id}|${a.syllabus_section_id}`;
    outliers.push({
      submissionId: row.id,
      submittedAt: row.submitted_at,
      assignmentTitle: a.title ?? '',
      assignmentType: a.type ?? '',
      factsInUnit: factsCountByUnit.get(unitKey) ?? 0,
      courseFacts: courseFactsCount.get(courseKey) ?? 0,
      hasSectionMarker: sectionMarkers.has(
        submissionMarkerKey(row.student_id, a.classroom_id, a.syllabus_section_id, row.id),
      ),
    });
  }

  outliers.sort((x, y) => x.factsInUnit - y.factsInUnit || String(x.submittedAt).localeCompare(String(y.submittedAt)));
  return outliers;
}

async function extractOne(submissionId) {
  const url = `${supabaseUrl}/functions/v1/extract-unit-memory`;
  return fetchJson(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ submissionId }),
  });
}

async function main() {
  let outliers = await listOutliers();

  if (opts.submissionId) {
    outliers = outliers.filter((o) => o.submissionId === opts.submissionId);
    if (outliers.length === 0) {
      outliers = [
        {
          submissionId: opts.submissionId,
          submittedAt: '',
          assignmentTitle: '(single id — not in outlier list)',
          assignmentType: '',
          factsInUnit: -1,
        },
      ];
    }
  }

  if (outliers.length === 0) {
    console.log('No outliers — every eligible submission has a memory marker.');
    return;
  }

  const toRun = outliers.slice(0, opts.limit);
  console.log(`Found ${outliers.length} outlier(s); processing ${toRun.length}.\n`);

  if (opts.dryRun) {
    for (const o of toRun) {
      console.log(
        `  ${o.submissionId}  unit_facts=${o.factsInUnit}  course_facts=${o.courseFacts}  section_marker=${o.hasSectionMarker}  ${o.assignmentTitle} (${o.assignmentType})`,
      );
    }
    console.log('\nDry run — re-run without --dry-run to invoke extract-unit-memory.');
    return;
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const o of toRun) {
    const { ok: resOk, status, data } = await extractOne(o.submissionId);
    const label = `${o.submissionId.slice(0, 8)}… ${o.assignmentTitle}`;

    if (!resOk) {
      failed++;
      console.log(`FAIL ${status} ${label}`);
      console.log(`     ${JSON.stringify(data)}`);
    } else if (data.skipped) {
      skipped++;
      console.log(`SKIP ${label}  reason=${data.reason ?? 'unknown'}`);
    } else {
      ok++;
      console.log(
        `OK   ${label}  factsExtracted=${data.factsExtracted ?? 0} totalFacts=${data.totalFacts ?? '?'}`,
      );
    }

    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\nDone: ${ok} extracted, ${skipped} skipped, ${failed} failed.`);

  const remaining = await listOutliers();
  console.log(`Remaining outliers: ${remaining.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
