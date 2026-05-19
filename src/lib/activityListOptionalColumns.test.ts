import { describe, expect, it } from 'vitest';
import { omitOptionalActivityListFields } from '@/lib/activityListOptionalColumns';

describe('omitOptionalActivityListFields', () => {
  it('removes optional columns used on slim activity_list schemas', () => {
    const row = {
      section_id: 'sec',
      title: 'Lesson',
      resource_type: 'lesson',
      order_index: 0,
      status: 'published',
      lesson_content: { version: 1, blocks: [] },
      estimated_duration_minutes: 20,
      summary: 'x',
    };
    expect(omitOptionalActivityListFields(row)).toEqual({
      section_id: 'sec',
      title: 'Lesson',
      resource_type: 'lesson',
      order_index: 0,
      status: 'published',
      lesson_content: { version: 1, blocks: [] },
    });
  });
});
