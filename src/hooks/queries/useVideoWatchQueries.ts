import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseLessonContent } from '@/lib/lessonContent';

export interface VideoWatchProgressRow {
  id: string;
  resource_id: string;
  lesson_block_id: string | null;
  student_user_id: string;
  classroom_id: string;
  play_count: number;
  total_watch_seconds: number;
  last_position_seconds: number;
  max_position_seconds: number;
  duration_seconds: number;
  completed: boolean;
  completion_count: number;
  first_watched_at: string;
  last_watched_at: string;
}

export interface VideoEngagementSummary {
  resourceId: string;
  lessonBlockId: string | null;
  title: string;
  uniqueViewers: number;
  totalPlays: number;
  totalCompletions: number;
  avgCompletionPct: number;
  studentRows: VideoWatchProgressRow[];
}

export const videoWatchKeys = {
  all: ['videoWatch'] as const,
  classroom: (classroomId: string) => [...videoWatchKeys.all, 'classroom', classroomId] as const,
};

function completionPct(row: VideoWatchProgressRow): number {
  if (row.duration_seconds <= 0) return row.completed ? 100 : 0;
  return Math.min(100, Math.round((row.max_position_seconds / row.duration_seconds) * 100));
}

function resolveVideoTitle(
  resourceTitle: string,
  lessonBlockId: string | null,
  lessonContent: unknown,
): string {
  if (!lessonBlockId) return resourceTitle;
  const parsed = parseLessonContent(lessonContent);
  const block = parsed?.blocks?.find((b) => b.id === lessonBlockId && b.type === 'video');
  if (block?.type === 'video' && block.display_name?.trim()) {
    return `${resourceTitle} — ${block.display_name.trim()}`;
  }
  return `${resourceTitle} — ${lessonBlockId.slice(0, 8)}`;
}

export function useVideoWatchAnalytics(classroomId: string | undefined) {
  return useQuery({
    queryKey: videoWatchKeys.classroom(classroomId || ''),
    queryFn: async (): Promise<VideoEngagementSummary[]> => {
      if (!classroomId) return [];

      const { data: progressRows, error } = await supabase
        .from('video_watch_progress')
        .select('*')
        .eq('classroom_id', classroomId);

      if (error) throw error;
      if (!progressRows?.length) return [];

      const resourceIds = [...new Set(progressRows.map((r) => r.resource_id))];
      const { data: resources, error: resourcesError } = await supabase
        .from('activity_list')
        .select('id, title, lesson_content')
        .in('id', resourceIds);

      if (resourcesError) throw resourcesError;

      const resourceMeta = new Map(
        (resources ?? []).map((r) => [r.id, { title: r.title, lesson_content: r.lesson_content }]),
      );

      const grouped = new Map<string, VideoWatchProgressRow[]>();
      for (const row of progressRows as VideoWatchProgressRow[]) {
        const key = `${row.resource_id}::${row.lesson_block_id ?? ''}`;
        const list = grouped.get(key) ?? [];
        list.push(row);
        grouped.set(key, list);
      }

      const summaries: VideoEngagementSummary[] = [];

      for (const [key, rows] of grouped) {
        const [resourceId, lessonBlockIdRaw] = key.split('::');
        const lessonBlockId = lessonBlockIdRaw || null;
        const meta = resourceMeta.get(resourceId);
        const title = resolveVideoTitle(
          meta?.title ?? resourceId,
          lessonBlockId,
          meta?.lesson_content,
        );

        const totalPlays = rows.reduce((sum, r) => sum + r.play_count, 0);
        const totalCompletions = rows.reduce((sum, r) => sum + (r.completion_count ?? 0), 0);
        const uniqueViewers = rows.length;
        const avgCompletionPct =
          rows.length > 0
            ? Math.round(rows.reduce((sum, r) => sum + completionPct(r), 0) / rows.length)
            : 0;

        summaries.push({
          resourceId,
          lessonBlockId,
          title,
          uniqueViewers,
          totalPlays,
          totalCompletions,
          avgCompletionPct,
          studentRows: rows.sort((a, b) => b.last_watched_at.localeCompare(a.last_watched_at)),
        });
      }

      return summaries.sort((a, b) => b.totalPlays - a.totalPlays);
    },
    enabled: !!classroomId,
    staleTime: 60_000,
  });
}

export function formatWatchPosition(seconds: number, duration: number): string {
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };
  if (duration > 0) {
    return `${fmt(seconds)} / ${fmt(duration)}`;
  }
  return fmt(seconds);
}
