import { describe, expect, it } from 'vitest';
import { normalizeAssignmentTypeForImport } from '@/lib/coursePackage/normalizeAssignmentType';

describe('normalizeAssignmentTypeForImport', () => {
  it('passes through valid enum values', () => {
    expect(normalizeAssignmentTypeForImport('chatbot')).toBe('chatbot');
    expect(normalizeAssignmentTypeForImport('text_essay')).toBe('text_essay');
  });

  it('maps submission to chatbot', () => {
    expect(normalizeAssignmentTypeForImport('submission')).toBe('chatbot');
  });

  it('defaults unknown types to chatbot', () => {
    expect(normalizeAssignmentTypeForImport('not_a_real_type')).toBe('chatbot');
  });
});
