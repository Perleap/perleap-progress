/**
 * Validates PR-SEC-RLS migration files and client RPC usage.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const requiredMigrations = [
  'supabase/migrations/20260825190000_pr_sec_rls_profiles_and_invite.sql',
  'supabase/migrations/20260825200000_pr_sec_rls_storage.sql',
  'supabase/migrations/20260826180000_pr_sec_rls_syllabus_resources_storage.sql',
  'supabase/migrations/20260826200000_pr_sec_rls_avatars_storage.sql',
];

const requiredClientSnippets = [
  ['src/pages/AuthCallback.tsx', 'cleanup_orphaned_profiles_by_email'],
  ['src/services/classroomService.ts', 'find_classroom_by_invite_code'],
  ['src/services/enrollmentService.ts', 'find_classroom_by_invite_code'],
  ['src/utils/storageUrls.ts', 'downloadStorageBlob'],
  ['src/utils/storageUrls.ts', 'createAuthenticatedBlobUrl'],
  ['src/utils/storageUrls.ts', 'resolveStorageStoredValue'],
  ['src/services/syllabusResourceService.ts', 'resolveSectionResourceForDisplay'],
  ['src/services/submissionFileService.ts', 'resolveSubmissionFileBlobUrl'],
  ['src/services/materialService.ts', 'resolveMaterialBlobUrl'],
  ['src/hooks/useAuthenticatedBlobUrl.ts', 'useAuthenticatedBlobUrl'],
  ['src/components/ui/SecureAvatarImage.tsx', 'SecureAvatarImage'],
];

/** Upload paths must store object paths, not createSignedUrl. */
const forbiddenSignedUrlUploads = [
  'src/components/features/assignment/ProjectSubmissionPage.tsx',
  'src/components/features/assignment/PresentationSubmissionPage.tsx',
  'src/components/features/assignment/chat/AssignmentChatInterface.tsx',
  'src/components/features/classroom/dialogs/EditClassroomDialog.tsx',
  'src/components/features/assignment/wizard/AssignmentWizardDialog.tsx',
];

let failed = false;

for (const rel of requiredMigrations) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    console.error(`FAIL: missing migration ${rel}`);
    failed = true;
    continue;
  }
  const sql = readFileSync(path, 'utf8');
  if (rel.includes('profiles') && !sql.includes('DROP POLICY IF EXISTS "teacher_profiles_duplicate_check"')) {
    console.error(`FAIL: ${rel} does not drop teacher_profiles_duplicate_check`);
    failed = true;
  } else {
    console.log(`OK: ${rel}`);
  }
}

for (const [rel, snippet] of requiredClientSnippets) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    console.error(`FAIL: missing file ${rel}`);
    failed = true;
    continue;
  }
  const content = readFileSync(path, 'utf8');
  if (!content.includes(snippet)) {
    console.error(`FAIL: ${rel} missing ${snippet}`);
    failed = true;
  } else {
    console.log(`OK: ${rel} uses ${snippet}`);
  }
}

for (const rel of forbiddenSignedUrlUploads) {
  const content = readFileSync(join(root, rel), 'utf8');
  if (content.includes('createSignedUrl')) {
    console.error(`FAIL: ${rel} still uses createSignedUrl on upload`);
    failed = true;
  } else {
    console.log(`OK: ${rel} does not createSignedUrl on upload`);
  }
}

if (failed) process.exit(1);
console.log('RLS config QA passed');
