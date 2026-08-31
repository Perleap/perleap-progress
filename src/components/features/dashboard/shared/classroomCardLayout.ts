import type { CSSProperties } from 'react';
import type { ClassroomViewMode } from '@/lib/classroomViewMode';

export function getClassroomCardsContainerProps(viewMode: ClassroomViewMode): {
  className: string;
  style?: CSSProperties;
} {
  const className =
    viewMode === 'grid'
      ? 'grid gap-4'
      : viewMode === 'compact'
        ? 'grid gap-3'
        : viewMode === 'list'
          ? 'flex flex-col gap-4'
          : 'grid gap-5';

  const style =
    viewMode === 'grid'
      ? { gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))' }
      : viewMode === 'compact'
        ? { gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))' }
        : viewMode === 'detailed'
          ? { gridTemplateColumns: 'repeat(auto-fill, minmax(min(350px, 100%), 1fr))' }
          : undefined;

  return { className, style };
}
