import { MAX_FILE_SIZE } from '@/config/constants';

const ALLOWED_MIME = new Set([
  'text/plain',
  'text/markdown',
  'application/pdf',
  'image/png',
  'image/jpeg',
]);

export type ChatAttachmentValidation = { ok: true } | { ok: false; reason: 'size' | 'type' };

export function validateChatAttachmentFile(file: File): ChatAttachmentValidation {
  if (file.size > MAX_FILE_SIZE) return { ok: false, reason: 'size' };
  const name = file.name.toLowerCase();
  if (file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    return { ok: true };
  }
  if (ALLOWED_MIME.has(file.type)) return { ok: true };
  if (name.endsWith('.pdf')) return { ok: true };
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) return { ok: true };
  return { ok: false, reason: 'type' };
}
