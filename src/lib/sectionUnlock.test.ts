import { describe, expect, it } from 'vitest';
import type { AssignmentRow } from '@/lib/moduleFlow';
import type { StudentFlowProgressContext } from '@/lib/moduleFlowStudent';
import { isSectionUnlocked } from '@/lib/sectionUnlock';
import type { StudentProgressStatus, SyllabusSection } from '@/types/syllabus';

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

  it('with sequentialFlow, prior module flow complete unlocks next without completed row', () => {
    const a = section('a', 0);
    const b = section('b', 1);
    const sections = [a, b];
    const progress: Record<string, StudentProgressStatus> = {};
    const flowCtx: StudentFlowProgressContext = {
      progressByStep: {},
      assignmentDoneMap: { a1: true },
    };
    const assignments: AssignmentRow[] = [{ id: 'a1', syllabus_section_id: 'a' }];
    const sequentialFlow = {
      flowBulk: { a: [], b: [] },
      resourceMap: { a: [], b: [] },
      assignments,
      flowCtx,
      now: new Date('2030-01-01T12:00:00.000Z'),
    };
    expect(isSectionUnlocked(b, sections, 'sequential', progress)).toBe(false);
    expect(isSectionUnlocked(b, sections, 'sequential', progress, sequentialFlow)).toBe(true);
  });
});
