/**
 * Builds deterministic, size-bounded text for assignment-scoped AI (chat, feedback, etc.).
 * Module activities come from assignment_module_activities + section_resources.
 */

export type ModuleActivityRow = {
  id: string;
  title: string;
  resource_type: string;
  url: string | null;
  body_text: string | null;
  summary: string | null;
  status?: string | null;
  /** lesson: v1 ordered blocks JSON */
  lesson_content?: unknown;
};

export type AssignmentModuleLinkRow = {
  section_resource_id: string;
  order_index: number;
  include_in_ai_context: boolean;
};

const MAX_TOTAL_CHARS = 12_000;
const MAX_PER_ITEM_CHARS = 4_000;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n… [truncated]`;
}

function stripHtmlLite(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function bodyFromLessonRow(r: ModuleActivityRow): string {
  const lc = r.lesson_content;
  if (
    lc &&
    typeof lc === 'object' &&
    (lc as { version?: unknown }).version === 1 &&
    Array.isArray((lc as { blocks?: unknown }).blocks)
  ) {
    const blocks = (lc as { blocks: Array<Record<string, unknown>> }).blocks;
    const pieces: string[] = [];
    for (const b of blocks) {
      if (b.type === 'text' && typeof b.body === 'string' && b.body.trim()) {
        const plain = stripHtmlLite(b.body);
        if (plain) pieces.push(truncate(plain, MAX_PER_ITEM_CHARS));
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

/**
 * Returns plain-text bundle and lightweight provenance for logging/extension.
 */
export function buildModuleActivityContextBundle(
  links: AssignmentModuleLinkRow[],
  resourcesById: Map<string, ModuleActivityRow>,
): { text: string; sources: Array<{ id: string; title: string }> } {
  const ordered = [...links]
    .filter((l) => l.include_in_ai_context)
    .sort((a, b) => a.order_index - b.order_index);

  const parts: string[] = [];
  const sources: Array<{ id: string; title: string }> = [];
  let total = 0;

  for (const link of ordered) {
    const r = resourcesById.get(link.section_resource_id);
    if (!r) continue;
    if (r.status === 'draft') continue;

    let body = '';
    if (r.resource_type === 'lesson') {
      body = bodyFromLessonRow(r);
    } else if (r.resource_type === 'text' && r.body_text?.trim()) {
      body = truncate(r.body_text.trim(), MAX_PER_ITEM_CHARS);
    } else if (r.summary?.trim()) {
      body = truncate(r.summary.trim(), MAX_PER_ITEM_CHARS);
    } else if (r.url?.trim()) {
      body = `URL: ${r.url.trim()}`;
    } else {
      body = '(No extractable text; see title only.)';
    }

    const block = `### ${r.title} (${r.resource_type})\n${body}`;
    if (total + block.length > MAX_TOTAL_CHARS) {
      const rest = MAX_TOTAL_CHARS - total;
      if (rest > 50) {
        parts.push(truncate(block, rest));
        total += rest;
      }
      break;
    }
    total += block.length + 2;
    parts.push(block);
    sources.push({ id: r.id, title: r.title });
  }

  if (parts.length === 0) {
    return { text: '', sources: [] };
  }

  return {
    text: `## Module learning activities (context)\n\n${parts.join('\n\n')}`,
    sources,
  };
}
