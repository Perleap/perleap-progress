/* eslint-disable import/order -- vi.mock must run before module under test */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { storage: { from: vi.fn() } },
}));

import {
  ASSIGNMENT_MATERIALS_BUCKET,
  extractStorageObjectPath,
  SUBMISSION_FILES_BUCKET,
} from '@/utils/storageUrls';

describe('extractStorageObjectPath', () => {
  it('returns raw path when value is not a URL', () => {
    const path = 'classroom-id/assignment/file.pdf';
    expect(extractStorageObjectPath(SUBMISSION_FILES_BUCKET, path)).toBe(path);
  });

  it('extracts path from public storage URL', () => {
    const url = `https://example.supabase.co/storage/v1/object/public/${SUBMISSION_FILES_BUCKET}/a/b/file.pdf`;
    expect(extractStorageObjectPath(SUBMISSION_FILES_BUCKET, url)).toBe('a/b/file.pdf');
  });

  it('extracts path from signed storage URL', () => {
    const url = `https://example.supabase.co/storage/v1/object/sign/${SUBMISSION_FILES_BUCKET}/assign/sub/doc.pdf?token=abc`;
    expect(extractStorageObjectPath(SUBMISSION_FILES_BUCKET, url)).toBe('assign/sub/doc.pdf');
  });

  it('returns null for external HTTP URL', () => {
    expect(extractStorageObjectPath(SUBMISSION_FILES_BUCKET, 'https://example.com/file.pdf')).toBe(
      null
    );
  });

  it('returns null for empty or whitespace', () => {
    expect(extractStorageObjectPath(SUBMISSION_FILES_BUCKET, '')).toBe(null);
    expect(extractStorageObjectPath(SUBMISSION_FILES_BUCKET, '   ')).toBe(null);
  });

  it('works for assignment-materials bucket', () => {
    const url = `https://x.supabase.co/storage/v1/object/public/${ASSIGNMENT_MATERIALS_BUCKET}/mat/notes.pdf`;
    expect(extractStorageObjectPath(ASSIGNMENT_MATERIALS_BUCKET, url)).toBe('mat/notes.pdf');
  });
});
