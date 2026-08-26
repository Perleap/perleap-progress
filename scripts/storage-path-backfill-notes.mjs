/**
 * Optional backfill helper: documents storage path normalization for legacy signed/public URLs.
 * Run manually against staging after client deploy if you want DB rows to store paths only.
 *
 * Usage: review output SQL in staging SQL editor — does NOT auto-execute.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function extractPath(bucket, url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.startsWith('http')) return url;
  const publicMarker = `/storage/v1/object/public/${bucket}/`;
  const signMarker = `/storage/v1/object/sign/${bucket}/`;
  const marker = url.includes(publicMarker) ? publicMarker : url.includes(signMarker) ? signMarker : null;
  if (!marker) return null;
  const idx = url.indexOf(marker);
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0] ?? '');
}

const hints = [
  '-- submissions.file_url / file_urls: replace signed URLs with extracted paths in application layer (legacy compat built-in).',
  '-- classrooms.materials / assignments.materials JSON: migrate url -> file_path for pdf entries client-side on read.',
  '-- profiles.avatar_url: store object path only for new uploads; legacy public URLs resolved at display time.',
  '',
  '-- Example path extraction (Node):',
  `extractPath('submission-files', 'https://.../object/sign/submission-files/a/b.pdf?token=...')`,
  `=> ${extractPath('submission-files', 'https://x.supabase.co/storage/v1/object/sign/submission-files/assign/sub/file.pdf?token=abc')}`,
];

const outPath = join(root, 'scripts', 'storage-path-backfill-notes.txt');
writeFileSync(outPath, hints.join('\n') + '\n');
console.log(`Wrote ${outPath}`);
