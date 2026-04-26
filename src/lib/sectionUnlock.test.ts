import { describe, expect, it } from 'vitest';
import { isSectionUnlocked } from '@/lib/sectionUnlock';
import type { SyllabusSection } from '@/types/syllabus';

function section(id: string, order_index: number): SyllabusSection {
  return {
    id,
    syllabus_id: 's1',
    title: id,
    description: null,
    content: null,
    order_index,
    start_date: null,
    end_date: null,
    objectives: [],
    resources: null,
    notes: null,
    completion_status: 'auto',
    prerequisites: [],
    is_locked: false,
    created_at: '',
    updated_at: '',
  };
}

describe('isSectionUnlocked sequential', () => {
  it('uses course order, not contiguous order_index, so gaps do not auto-unlock', () => {
    const a = section('a', 0);
    const b = section('b', 1);
    const c = section('c', 5);
    const d = section('d', 10);
    const sections = [d, a, c, b];
    const empty: Record<string, 'completed'> = {};

    expect(isSectionUnlocked(a, sections, 'sequential', empty)).toBe(true);
    expect(isSectionUnlocked(b, sections, 'sequential', empty)).toBe(false);
    expect(isSectionUnlocked(c, sections, 'sequential', empty)).toBe(false);
    expect(isSectionUnlocked(d, sections, 'sequential', empty)).toBe(false);

    const afterA = { ...empty, a: 'completed' as const };
    expect(isSectionUnlocked(b, sections, 'sequential', afterA)).toBe(true);
    expect(isSectionUnlocked(c, sections, 'sequential', afterA)).toBe(false);
  });

  it('requires every earlier section completed, not only the immediate predecessor', () => {
    const a = section('a', 0);
    const b = section('b', 1);
    const c = section('c', 2);
    const sections = [a, b, c];
    const gap: Record<string, 'completed' | 'not_started'> = {
      a: 'not_started',
      b: 'completed',
      c: 'not_started',
    };
    expect(isSectionUnlocked(b, sections, 'sequential', gap)).toBe(false);
    expect(isSectionUnlocked(c, sections, 'sequential', gap)).toBe(false);
  });
});
