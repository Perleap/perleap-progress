import { describe, expect, it } from 'vitest';
import {
  filterOutlineMaterialResources,
  isOutlineMaterialResource,
  isOutlineMaterialResourceType,
} from './moduleFlow';
import type { SectionResource } from '@/types/syllabus';

const base = {
  section_id: 'sec1',
  title: 'T',
  file_path: null,
  url: null,
  mime_type: null,
  file_size: null,
  created_at: '2020-01-01T00:00:00.000Z',
  updated_at: '2020-01-01T00:00:00.000Z',
} satisfies Partial<SectionResource>;

function row(
  id: string,
  resource_type: SectionResource['resource_type'],
  order_index: number,
  extra?: Partial<SectionResource>,
): SectionResource {
  return { ...base, id, resource_type, order_index, ...extra } as SectionResource;
}

describe('outline material helpers', () => {
  it('isOutlineMaterialResourceType matches file, link, document, image only', () => {
    expect(isOutlineMaterialResourceType('link')).toBe(true);
    expect(isOutlineMaterialResourceType('file')).toBe(true);
    expect(isOutlineMaterialResourceType('lesson')).toBe(false);
    expect(isOutlineMaterialResourceType('text')).toBe(false);
    expect(isOutlineMaterialResourceType('video')).toBe(false);
  });

  it('isOutlineMaterialResource proxies type', () => {
    expect(isOutlineMaterialResource(row('a', 'document', 0))).toBe(true);
    expect(isOutlineMaterialResource(row('b', 'lesson', 0))).toBe(false);
  });

  it('filterOutlineMaterialResources orders by order_index and keeps outline types only', () => {
    const out = filterOutlineMaterialResources([
      row('l', 'lesson', 0),
      row('b', 'link', 2),
      row('a', 'file', 1),
    ]);
    expect(out.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('filterOutlineMaterialResources omits drafts when excludeDrafts', () => {
    const out = filterOutlineMaterialResources(
      [row('x', 'link', 0, { status: 'draft' }), row('y', 'link', 1, { status: 'published' })],
      { excludeDrafts: true },
    );
    expect(out.map((r) => r.id)).toEqual(['y']);
  });

  it('filterOutlineMaterialResources excludes id when requested', () => {
    const out = filterOutlineMaterialResources([row('keep', 'link', 0), row('drop', 'file', 1)], {
      excludeResourceId: 'drop',
    });
    expect(out.map((r) => r.id)).toEqual(['keep']);
  });
});
