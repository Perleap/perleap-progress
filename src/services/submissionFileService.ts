import type { Message } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import {
  extractStorageObjectPath,
  downloadStorageBlob,
  resolveStorageStoredValue,
  SUBMISSION_FILES_BUCKET,
  type AuthenticatedBlobUrl,
} from '@/utils/storageUrls';

export function extractSubmissionStoragePath(stored: string): string | null {
  return extractStorageObjectPath(SUBMISSION_FILES_BUCKET, stored);
}

function inferAttachmentTypeFromName(name: string, explicit?: string): string {
  if (explicit === 'image' || explicit === 'pdf') return explicit;
  if (/\.(jpg|jpeg|png|webp|gif)$/i.test(name)) return 'image';
  if (/\.pdf$/i.test(name)) return 'pdf';
  return 'text';
}

export function isSubmissionPdfAttachment(name: string, type?: string): boolean {
  return type === 'pdf' || /\.pdf$/i.test(name);
}

/** Resolve private storage to a blob URL and open it in a new browser tab. */
export async function openSubmissionFileInNewTab(pathOrLegacyUrl: string): Promise<boolean> {
  const resolved = await resolveSubmissionFileBlobUrl(pathOrLegacyUrl);
  if (!resolved?.url) return false;
  window.open(resolved.url, '_blank', 'noopener,noreferrer');
  return true;
}

/** Match chat uploads stored as {submissionId}/{timestamp}_{filename}. */
export async function resolveChatAttachmentStoragePath(
  submissionId: string,
  fileName: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(SUBMISSION_FILES_BUCKET)
    .list(submissionId, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
  if (error || !data?.length) return null;

  const normalized = fileName.trim();
  const safe = normalized.replace(/[^\w.-]+/g, '_');

  const match = data.find((obj) => {
    const n = obj.name;
    return (
      n === normalized ||
      n.endsWith(`_${normalized}`) ||
      n.endsWith(`_${safe}`) ||
      n.includes(normalized)
    );
  });

  return match ? `${submissionId}/${match.name}` : null;
}

export async function enrichConversationMessagesWithAttachmentPaths(
  submissionId: string,
  messages: Message[]
): Promise<Message[]> {
  const needsLookup = messages.filter(
    (m) => m.role === 'user' && m.fileContext?.name && !m.fileContext.url
  );
  if (needsLookup.length === 0) return messages;

  const resolved = new Map<string, string>();
  for (const msg of needsLookup) {
    const name = msg.fileContext!.name;
    if (resolved.has(name)) continue;
    const path = await resolveChatAttachmentStoragePath(submissionId, name);
    if (path) resolved.set(name, path);
  }

  if (resolved.size === 0) return messages;

  return messages.map((msg) => {
    if (msg.role !== 'user' || !msg.fileContext?.name || msg.fileContext.url) return msg;
    const path = resolved.get(msg.fileContext.name);
    if (!path) return msg;
    return {
      ...msg,
      fileContext: {
        ...msg.fileContext,
        url: path,
        type: inferAttachmentTypeFromName(msg.fileContext.name, msg.fileContext.type),
      },
    };
  });
}

export async function downloadSubmissionFile(path: string): Promise<Blob | null> {
  return downloadStorageBlob(SUBMISSION_FILES_BUCKET, path);
}

export async function resolveSubmissionFileBlobUrl(
  pathOrLegacyUrl: string | null | undefined
): Promise<AuthenticatedBlobUrl | null> {
  if (!pathOrLegacyUrl?.trim()) return null;
  return resolveStorageStoredValue(SUBMISSION_FILES_BUCKET, null, pathOrLegacyUrl.trim());
}

export async function resolveSubmissionFileDisplayUrls(
  fileUrl: string | null | undefined,
  fileUrls: string[] | null | undefined
): Promise<{ urls: string[]; revokeAll: () => void }> {
  const raw = fileUrls && fileUrls.length > 0 ? fileUrls : fileUrl ? [fileUrl] : [];
  const revokes: (() => void)[] = [];
  const urls: string[] = [];

  for (const item of raw) {
    const resolved = await resolveSubmissionFileBlobUrl(item);
    if (resolved) {
      revokes.push(resolved.revoke);
      urls.push(resolved.url);
    }
  }

  return {
    urls,
    revokeAll: () => revokes.forEach((r) => r()),
  };
}

export function fileNameFromSubmissionStored(stored: string): string {
  const path = extractSubmissionStoragePath(stored) ?? stored;
  return decodeURIComponent(path.split('/').pop() || 'file');
}
