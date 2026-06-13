/**
 * Extract readable text from project submission file_urls.
 * Caches combined text on submissions.artifact_transcript (max 30k chars).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@0.11.0';
import { logInfo } from '../shared/logger.ts';

const MAX_ARTIFACT_CHARS = 30_000;

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'cpp', 'h',
  'cs', 'go', 'rs', 'rb', 'php', 'html', 'css', 'scss', 'xml', 'yaml', 'yml', 'csv', 'sql',
  'sh', 'bat', 'ps1', 'rtf',
]);

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);

function extensionFromUrl(url: string): string {
  const path = url.split('?')[0] ?? url;
  const match = path.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
}

function fileLabelFromUrl(url: string): string {
  const path = url.split('?')[0] ?? url;
  return decodeURIComponent(path.split('/').pop() || 'file');
}

function capText(text: string): string {
  if (text.length <= MAX_ARTIFACT_CHARS) return text;
  return `${text.slice(0, MAX_ARTIFACT_CHARS)}\n\n[Truncated at ${MAX_ARTIFACT_CHARS} characters]`;
}

async function fetchFileBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch file (${res.status}): ${url}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function extractTextFromUrl(url: string): Promise<string> {
  const ext = extensionFromUrl(url);
  const label = fileLabelFromUrl(url);

  if (IMAGE_EXTENSIONS.has(ext)) {
    return `[File: ${label}] Image file — text content not extractable.`;
  }

  if (ext === 'pdf') {
    const bytes = await fetchFileBytes(url);
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return `[File: ${label}]\n${text.trim() || '(empty PDF)'}`;
  }

  if (TEXT_EXTENSIONS.has(ext) || !ext) {
    const bytes = await fetchFileBytes(url);
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
  for (const url of urls) {
    try {
      sections.push(await extractTextFromUrl(url));
    } catch (err) {
      const label = fileLabelFromUrl(url);
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
