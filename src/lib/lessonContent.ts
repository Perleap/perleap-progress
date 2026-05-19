import type {
  LessonBlockV1,
  LessonContentV1,
  LessonTextBlockV1,
  LessonVideoBlockV1,
  LessonVideoSource,
  SectionResource,
} from '@/types/syllabus';
import { isYoutubeUrl, parseYoutubeUrl } from '@/lib/youtube';

const DIRECT_VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov)(\?|$)/i;

/** Infer upload vs YouTube when `source` is not stored (legacy blocks). */
export function inferLessonVideoSource(block: LessonVideoBlockV1): LessonVideoSource {
  if (block.source === 'upload' || block.source === 'youtube') return block.source;
  if (block.file_path) return 'upload';
  const url = block.url?.trim() ?? '';
  if (!url) return 'upload';
  if (isYoutubeUrl(url)) return 'youtube';
  if (block.mime_type?.startsWith('video/') || DIRECT_VIDEO_EXT_RE.test(url)) return 'upload';
  return 'upload';
}

export function lessonVideoBlockHasContent(block: LessonVideoBlockV1): boolean {
  const source = inferLessonVideoSource(block);
  if (source === 'youtube') {
    return !!(block.url?.trim() && parseYoutubeUrl(block.url));
  }
  return !!(block.file_path || (block.url?.trim() && !isYoutubeUrl(block.url)));
}

export function shouldShowLessonVideoBlock(block: LessonVideoBlockV1): boolean {
  return lessonVideoBlockHasContent(block);
}

export function parseLessonContent(raw: unknown): LessonContentV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 || !Array.isArray(o.blocks)) return null;
  return o as unknown as LessonContentV1;
}

/** Legacy single body + optional single video → block list for the editor */
export function legacyLessonToBlocks(r: SectionResource): LessonBlockV1[] {
  const blocks: LessonBlockV1[] = [];
  if (r.body_text?.trim()) {
    blocks.push({
      id: crypto.randomUUID(),
      type: 'text',
      body: r.body_text,
    });
  }
  const hasVideo = !!(r.file_path || (r.url && r.url.trim()));
  if (hasVideo) {
    const display = r.file_path?.split('/').pop() ?? r.url?.split('/').pop() ?? 'video';
    blocks.push({
      id: crypto.randomUUID(),
      type: 'video',
      url: r.url,
      file_path: r.file_path,
      mime_type: r.mime_type,
      file_size: r.file_size,
      display_name: display,
    });
  }
  return blocks;
}

export function lessonBlocksHaveContent(blocks: LessonBlockV1[]): boolean {
  for (const b of blocks) {
    if (b.type === 'text') {
      if (b.slides && b.slides.length > 0) {
        if (b.slides.some((s) => s.trim())) return true;
        continue;
      }
      if (b.body.trim()) return true;
      continue;
    }
    if (b.type === 'video' && lessonVideoBlockHasContent(b)) return true;
  }
  return false;
}

/**
 * Plain HTML segments from a text block for AI context (all slides, or legacy body).
 */
export function getLessonTextBlockBodiesForContext(block: LessonTextBlockV1): string[] {
  if (block.slides && block.slides.length > 0) {
    return block.slides.map((s) => (typeof s === 'string' ? s : ''));
  }
  if (block.body?.trim()) return [block.body];
  return [];
}

/** Persistable copy (no UI-only fields) */
export function toPersistedLessonContent(blocks: LessonBlockV1[]): LessonContentV1 {
  const persisted: LessonBlockV1[] = blocks.map((b) => {
    if (b.type === 'text') {
      if (b.slides && b.slides.length > 0) {
        const first = b.slides[0] ?? '';
        const t: LessonTextBlockV1 = { id: b.id, type: 'text', body: first };
        if (b.slides.length > 1) t.slides = b.slides;
        return t;
      }
      const t: LessonTextBlockV1 = { id: b.id, type: 'text', body: b.body };
      return t;
    }
    const source = inferLessonVideoSource(b);
    const v: LessonVideoBlockV1 = {
      id: b.id,
      type: 'video',
      url: b.url,
      file_path: b.file_path,
      mime_type: b.mime_type,
      file_size: b.file_size,
      display_name: b.display_name,
    };
    if (source === 'youtube') v.source = 'youtube';
    else if (b.source === 'upload' || b.file_path) v.source = 'upload';
    return v;
  });
  return { version: 1, blocks: persisted };
}
