/**
 * One-time: merge student_section_unit_memory rows into student_classroom_course_memory.
 *
 * Requires .env: VITE_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/migrate-section-memory-to-course.mjs
 *   node scripts/migrate-section-memory-to-course.mjs --dry-run
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

function fingerprintFact(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?,;:]+\s*$/g, '')
    .trim()
    .slice(0, 48);
}

function mergeFacts(existing, incoming, maxFacts) {
  const seen = new Set(existing.map((f) => fingerprintFact(f.text)));
  const merged = [...existing];
  for (const fact of incoming) {
    const fp = fingerprintFact(fact.text);
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    merged.push(fact);
  }
  merged.sort((a, b) => String(b.extracted_at).localeCompare(String(a.extracted_at)));
  return merged.slice(0, maxFacts);
}

loadEnvFile();

const dryRun = process.argv.includes('--dry-run');
const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(
  /\/$/,
  '',
);
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
const MAX_COURSE_FACTS = 60;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function fetchAll(path) {
  const url = `${supabaseUrl}/rest/v1/${path}`;
  const res = await fetch(url, { headers: { ...headers, Prefer: 'return=representation' } });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function main() {
  const sectionRows = await fetchAll(
    'student_section_unit_memory?select=student_id,classroom_id,syllabus_section_id,facts',
  );

  const sectionTitles = new Map();
  const sectionIds = [...new Set(sectionRows.map((r) => r.syllabus_section_id))];
  if (sectionIds.length > 0) {
    const sections = await fetchAll(
      `syllabus_sections?select=id,title&id=in.(${sectionIds.join(',')})`,
    );
    for (const s of sections) {
      sectionTitles.set(s.id, s.title ?? '');
    }
  }

  const byCourse = new Map();
  for (const row of sectionRows) {
    const key = `${row.student_id}|${row.classroom_id}`;
    if (!byCourse.has(key)) {
      byCourse.set(key, { student_id: row.student_id, classroom_id: row.classroom_id, facts: [], processed: new Set() });
    }
    const bucket = byCourse.get(key);
    const facts = Array.isArray(row.facts) ? row.facts : [];
    const sectionTitle = sectionTitles.get(row.syllabus_section_id) ?? '';
    for (const f of facts) {
      if (!f?.submission_id || !f?.text) continue;
      bucket.processed.add(String(f.submission_id));
      bucket.facts.push({
        ...f,
        syllabus_section_id: row.syllabus_section_id,
        syllabus_section_title: sectionTitle || undefined,
      });
    }
  }

  const existingCourse = await fetchAll(
    'student_classroom_course_memory?select=id,student_id,classroom_id,facts,processed_submission_ids',
  );
  const existingByKey = new Map(
    existingCourse.map((r) => [`${r.student_id}|${r.classroom_id}`, r]),
  );

  let upserts = 0;
  for (const [key, bucket] of byCourse) {
    const existing = existingByKey.get(key);
    const existingFacts = Array.isArray(existing?.facts) ? existing.facts : [];
    const existingProcessed = new Set(
      Array.isArray(existing?.processed_submission_ids)
        ? existing.processed_submission_ids.filter((x) => typeof x === 'string')
        : [],
    );
    for (const id of bucket.processed) existingProcessed.add(id);

    const merged = mergeFacts(existingFacts, bucket.facts, MAX_COURSE_FACTS);
    const processedIds = [...existingProcessed];

    if (dryRun) {
      console.log(
        `  ${key}: +${bucket.facts.length} section facts -> ${merged.length} total, ${processedIds.length} processed ids`,
      );
      upserts++;
      continue;
    }

    if (existing?.id) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/student_classroom_course_memory?id=eq.${existing.id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ facts: merged, processed_submission_ids: processedIds }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
    } else {
      const res = await fetch(`${supabaseUrl}/rest/v1/student_classroom_course_memory`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          student_id: bucket.student_id,
          classroom_id: bucket.classroom_id,
          facts: merged,
          processed_submission_ids: processedIds,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    }
    upserts++;
  }

  console.log(
    dryRun
      ? `Dry run: would upsert ${upserts} course memory row(s).`
      : `Migrated ${upserts} course memory row(s).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
