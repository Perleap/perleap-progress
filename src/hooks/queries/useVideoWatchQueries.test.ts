import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

import {
  formatWatchPercent,
  getVideoWatchCompletionPct,
  type VideoWatchProgressRow,
} from '@/hooks/queries/useVideoWatchQueries';

function makeRow(
  overrides: Pick<
    VideoWatchProgressRow,
    'max_position_seconds' | 'duration_seconds' | 'completed'
  > &
    Partial<VideoWatchProgressRow>,
): VideoWatchProgressRow {
  return {
    id: 'row-1',
    resource_id: 'resource-1',
    lesson_block_id: null,
    student_user_id: 'student-1',
    classroom_id: 'classroom-1',
    play_count: 1,
    total_watch_seconds: 0,
    last_position_seconds: 0,
    completion_count: 0,
    first_watched_at: '2026-01-01T00:00:00.000Z',
    last_watched_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getVideoWatchCompletionPct', () => {
  it('returns 100 when max position equals duration', () => {
    expect(getVideoWatchCompletionPct(makeRow({ max_position_seconds: 8, duration_seconds: 8, completed: true }))).toBe(
      100,
    );
  });

  it('returns rounded percent for partial watches', () => {
    expect(getVideoWatchCompletionPct(makeRow({ max_position_seconds: 4, duration_seconds: 8, completed: false }))).toBe(
      50,
    );
  });

  it('returns 100 when duration is unknown but row is completed', () => {
    expect(getVideoWatchCompletionPct(makeRow({ max_position_seconds: 0, duration_seconds: 0, completed: true }))).toBe(
      100,
    );
  });

  it('returns 0 when duration is unknown and row is not completed', () => {
    expect(
      getVideoWatchCompletionPct(makeRow({ max_position_seconds: 0, duration_seconds: 0, completed: false })),
    ).toBe(0);
  });
});

describe('formatWatchPercent', () => {
  it('formats completion percent with a percent sign', () => {
    expect(formatWatchPercent(makeRow({ max_position_seconds: 8, duration_seconds: 8, completed: true }))).toBe('100%');
    expect(formatWatchPercent(makeRow({ max_position_seconds: 4, duration_seconds: 8, completed: false }))).toBe('50%');
  });
});
