/**
 * Extract readable text from project submission file_urls.
 * Caches combined text on submissions.artifact_transcript (max 30k chars).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@0.11.0';
import { logInfo } from '../shared/logger.ts';
import {
  extractSubmissionStoragePath,
  SUBMISSION_FILES_BUCKET,
} from './storagePaths.ts';

const MAX_ARTIFACT_CHARS = 30_000;

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'cpp', 'h',
  'cs', 'go', 'rs', 'rb', 'php', 'html', 'css', 'scss', 'xml', 'yaml', 'yml', 'csv', 'sql',
  'sh', 'bat', 'ps1', 'rtf',
]);

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);

function extensionFromPath(path: string): string {
  const match = path.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
}

function fileLabelFromPath(path: string): string {
  return decodeURIComponent(path.split('/').pop() || 'file');
}

function capText(text: string): string {
  if (text.length <= MAX_ARTIFACT_CHARS) return text;
  return `${text.slice(0, MAX_ARTIFACT_CHARS)}\n\n[Truncated at ${MAX_ARTIFACT_CHARS} characters]`;
}

async function downloadSubmissionBytes(
  supabase: SupabaseClient,
  stored: string,
): Promise<Uint8Array> {
  const path = extractSubmissionStoragePath(stored) ?? stored.trim();
  if (!path) {
    throw new Error('Invalid submission file path');
  }

  const { data, error } = await supabase.storage.from(SUBMISSION_FILES_BUCKET).download(path);
  if (error || !data) {
    throw new Error(`Failed to download submission file (${error?.message ?? 'unknown'}): ${path}`);
  }
  return new Uint8Array(await data.arrayBuffer());
}

async function extractTextFromStoredFile(
  supabase: SupabaseClient,
  stored: string,
): Promise<string> {
  const path = extractSubmissionStoragePath(stored) ?? stored.trim();
  const ext = extensionFromPath(path);
  const label = fileLabelFromPath(path);

  if (IMAGE_EXTENSIONS.has(ext)) {
    return `[File: ${label}] Image file — text content not extractable.`;
  }

  const bytes = await downloadSubmissionBytes(supabase, stored);

  if (ext === 'pdf') {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return `[File: ${label}]\n${text.trim() || '(empty PDF)'}`;
  }

  if (TEXT_EXTENSIONS.has(ext) || !ext) {
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return `[File: ${label}]\n${decoded.trim() || '(empty file)'}`;
  }

  return `[File: ${label}] Unsupported file type (.${ext}) — content not extracted.`;
}

export async function ensureProjectFilesTranscript(
  supabase: SupabaseClient,
  submissionId: string,
  fileUrls: string[] | null | undefined,
  fileUrl: string | null | undefined,
  cachedTranscript?: string | null,
): Promise<string> {
  const trimmed = cachedTranscript?.trim();
  if (trimmed) return trimmed;

  const urls = fileUrls && fileUrls.length > 0
    ? fileUrls
    : fileUrl
    ? [fileUrl]
    : [];

  if (urls.length === 0) {
    throw new Error('No project files found for this submission.');
  }

  logInfo(`Extracting text from ${urls.length} project file(s) for submission ${submissionId}`);
  const sections: string[] = [];
  for (const stored of urls) {
    try {
      sections.push(await extractTextFromStoredFile(supabase, stored));
    } catch (err) {
      const label = fileLabelFromPath(extractSubmissionStoragePath(stored) ?? stored);
      sections.push(`[File: ${label}] Failed to extract text: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const combined = capText(sections.join('\n\n'));
  if (!combined.trim()) {
    throw new Error('Could not extract readable text from project files.');
  }

  await supabase
    .from('submissions')
    .update({ artifact_transcript: combined })
    .eq('id', submissionId);

  return combined;
}
