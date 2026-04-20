import { describe, expect, it } from 'vitest';
import { getStudyCtaTarget } from './studyCtaTarget';
import type { SyllabusSection } from '@/types/syllabus';

function section(id: string, order_index: number): SyllabusSection {
  return {
    id,
    syllabus_id: 'sy-1',
    title: id,
    description: null,
    content: null,
    order_index,
    start_date: null,
    end_date: null,
    objectives: null,
    resources: null,
    notes: null,
    completion_status: 'auto',
    prerequisites: null,
    is_locked: false,
    created_at: '',
    updated_at: '',
  };
}

describe('getStudyCtaTarget', () => {
  it('targets first incomplete section in order even when earlier section would be locked under date_based', () => {
    const s0 = { ...section('m1', 0), start_date: '2099-01-01' };
    const s1 = { ...section('m2', 1), start_date: null };
    const sections = [s1, s0];
    const result = getStudyCtaTarget(sections, 'date_based', {});
    expect(result).toEqual({ targetSectionId: 'm1', variant: 'start' });
  });

  it('after first section completed, targets next incomplete section', () => {
    const sections = [section('m1', 0), section('m2', 1)];
    const result = getStudyCtaTarget(sections, 'all_at_once', { m1: 'completed' });
    expect(result).toEqual({ targetSectionId: 'm2', variant: 'start' });
  });

  it('does not skip an earlier not-started module when a later module is in_progress', () => {
    const sections = [section('positioning', 0), section('aim', 1)];
    const result = getStudyCtaTarget(sections, 'all_at_once', {
      aim: 'in_progress',
    });
    expect(result).toEqual({ targetSectionId: 'positioning', variant: 'start' });
  });

  it('first incomplete with in_progress yields continue', () => {
    const sections = [section('m1', 0), section('m2', 1)];
    const result = getStudyCtaTarget(sections, 'all_at_once', {
      m1: 'completed',
      m2: 'in_progress',
    });
    expect(result).toEqual({ targetSectionId: 'm2', variant: 'continue' });
  });

  it('first incomplete with reviewed yields continue', () => {
    const sections = [section('m1', 0), section('m2', 1)];
    const result = getStudyCtaTarget(sections, 'all_at_once', {
      m1: 'completed',
      m2: 'reviewed',
    });
    expect(result).toEqual({ targetSectionId: 'm2', variant: 'continue' });
  });

  it('all completed yields review on first section', () => {
    const sections = [section('m1', 0), section('m2', 1)];
    const result = getStudyCtaTarget(sections, 'all_at_once', {
      m1: 'completed',
      m2: 'completed',
    });
    expect(result).toEqual({ targetSectionId: 'm1', variant: 'review' });
  });
});

describe('getStudyCtaTarget aboutPrimaryCta', () => {
  it('always targets first module in order; label review when that module is completed', () => {
    const sections = [section('positioning', 0), section('maps', 1), section('weapons', 2)];
    const result = getStudyCtaTarget(
      sections,
      'all_at_once',
      { positioning: 'completed', maps: 'completed' },
      { aboutPrimaryCta: true }
    );
    expect(result).toEqual({ targetSectionId: 'positioning', variant: 'review' });
  });

  it('aboutPrimaryCta: first module not_started yields start', () => {
    const sections = [section('m1', 0), section('m2', 1)];
    const result = getStudyCtaTarget(sections, 'all_at_once', {}, { aboutPrimaryCta: true });
    expect(result).toEqual({ targetSectionId: 'm1', variant: 'start' });
  });

  it('aboutPrimaryCta: first module in_progress yields continue', () => {
    const sections = [section('m1', 0), section('m2', 1)];
    const result = getStudyCtaTarget(
      sections,
      'all_at_once',
      { m1: 'in_progress' },
      { aboutPrimaryCta: true }
    );
    expect(result).toEqual({ targetSectionId: 'm1', variant: 'continue' });
  });
});
