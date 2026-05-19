import { describe, expect, it } from 'vitest';
import {
  stripUnknownColumnFromActivityPayload,
  unknownPostgrestColumnName,
} from '@/lib/activityListSchemaFallback';

describe('unknownPostgrestColumnName', () => {
  it('parses single-quoted PostgREST schema cache message', () => {
    const msg =
      "Could not find the 'estimated_duration_minutes' column of 'activity_list' in the schema cache";
    expect(unknownPostgrestColumnName({ message: msg })).toBe('estimated_duration_minutes');
    expect(unknownPostgrestColumnName(msg)).toBe('estimated_duration_minutes');
  });

  it('parses double-quoted column name', () => {
    expect(
      unknownPostgrestColumnName({
        message: 'Could not find the "body_text" column of "activity_list" in the schema cache',
      }),
    ).toBe('body_text');
  });

  it('returns null for unrelated errors', () => {
    expect(unknownPostgrestColumnName({ message: 'permission denied' })).toBeNull();
  });
});

describe('stripUnknownColumnFromActivityPayload', () => {
  it('removes a known unknown column from insert payload', () => {
    const before = {
      section_id: 'sec-uuid',
      title: 'Lesson',
      resource_type: 'lesson',
      estimated_duration_minutes: 20,
    };
    const after = stripUnknownColumnFromActivityPayload(before, 'estimated_duration_minutes');
    expect(after).toEqual({
      section_id: 'sec-uuid',
      title: 'Lesson',
      resource_type: 'lesson',
    });
    expect(after).not.toHaveProperty('estimated_duration_minutes');
  });

  it('returns same object when column is absent', () => {
    const payload = { section_id: 'x', title: 'y' };
    expect(stripUnknownColumnFromActivityPayload(payload, 'summary')).toBe(payload);
  });
});
