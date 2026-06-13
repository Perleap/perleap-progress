export interface VideoWatchTrackingContext {
  resourceId: string;
  lessonBlockId?: string | null;
  classroomId: string;
  studentUserId: string;
}

/** Passed from pages; resource and block ids are added at render sites. */
export type VideoWatchTrackingBase = Pick<VideoWatchTrackingContext, 'classroomId' | 'studentUserId'>;
