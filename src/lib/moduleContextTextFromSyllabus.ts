/**
 * Plain-text bundle of selected module activities for teacher-side AI (e.g. rephrase instructions).
 * Keep extraction rules and caps in sync with supabase/functions/_shared/assignmentContext.ts
 */
import { getLessonTextBlockBodiesForContext } from '@/lib/lessonContent';
import type { LessonTextBlockV1, SectionResource } from '@/types/syllabus';

const MAX_TOTAL_CHARS = 12_000;
const MAX_PER_ITEM_CHARS = 4_000;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n… [truncated]`;
}

function stripHtmlLite(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

type ResourceRow = Pick<
  SectionResource,
  | 'id'
  | 'title'
  | 'resource_type'
  | 'url'
  | 'body_text'
  | 'summary'
  | 'status'
  | 'lesson_content'
>;

function bodyFromLessonRow(r: ResourceRow): string {
  const lc = r.lesson_content;
  if (
    lc &&
    typeof lc === 'object' &&
    lc.version === 1 &&
    Array.isArray(lc.blocks)
  ) {
    const pieces: string[] = [];
    for (const b of lc.blocks) {
      if (b.type === 'text' && typeof b.body === 'string') {
        for (const seg of getLessonTextBlockBodiesForContext(b as LessonTextBlockV1)) {
          if (!seg.trim()) continue;
          const plain = stripHtmlLite(seg);
          if (plain) pieces.push(truncate(plain, MAX_PER_ITEM_CHARS));
        }
      } else if (b.type === 'video') {
        const u = typeof b.url === 'string' ? b.url.trim() : '';
        const fp = typeof b.file_path === 'string' ? b.file_path : '';
        if (u) pieces.push(`Video URL: ${u}`);
        else if (fp) pieces.push(`Video file: ${fp}`);
      }
    }
    if (pieces.length) return pieces.join('\n\n');
  }
  if (r.body_text?.trim()) return truncate(r.body_text.trim(), MAX_PER_ITEM_CHARS);
  if (r.url?.trim()) return `URL: ${r.url.trim()}`;
  return '(No extractable text; see title only.)';
}

function bodyFromResource(r: ResourceRow): string {
  if (r.resource_type === 'lesson') {
    return bodyFromLessonRow(r);
  }
  if (r.resource_type === 'text' && r.body_text?.trim()) {
    return truncate(r.body_text.trim(), MAX_PER_ITEM_CHARS);
  }
  if (r.summary?.trim()) {
    return truncate(r.summary.trim(), MAX_PER_ITEM_CHARS);
  }
  if (r.url?.trim()) {
    return `URL: ${r.url.trim()}`;
  }
  return '(No extractable text; see title only.)';
}

/**
 * @param orderedResourceIds Section resource ids in display/syllabus order (e.g. linkedModuleActivityIds)
 * @param resources All resources for the section (from syllabus.section_resources[sectionId])
 */
export function buildModuleContextTextFromSyllabusResources(
  orderedResourceIds: string[],
  resources: SectionResource[],
): string {
  if (!orderedResourceIds.length || !resources.length) return '';

  const byId = new Map(resources.map((r) => [r.id, r]));
  const parts: string[] = [];
  let total = 0;

  for (const id of orderedResourceIds) {
    const r = byId.get(id);
    if (!r) continue;
    if (r.status === 'draft') continue;

    const body = bodyFromResource(r);
    const block = `### ${r.title} (${r.resource_type})\n${body}`;

    if (total + block.length > MAX_TOTAL_CHARS) {
      const rest = MAX_TOTAL_CHARS - total;
      if (rest > 50) {
        parts.push(truncate(block, rest));
      }
      break;
    }
    total += block.length + 2;
    parts.push(block);
  }

  if (parts.length === 0) return '';
  return `## Module learning activities (context)\n\n${parts.join('\n\n')}`;
}
