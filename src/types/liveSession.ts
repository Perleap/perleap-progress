/**
 * Live Session types
 * A live session is an assignment (type = 'live_session') plus a side row in `live_sessions`
 * holding the uploaded media and AI-generated transcript/summary/timestamps.
 */

export type LiveSessionType = 'workshop' | 'lecture' | 'practice';

export type LiveSessionStatus =
  | 'uploaded'
  | 'extracting'
  | 'extracted'
  | 'transcribing'
  | 'ready'
  | 'failed';

/** A single key-moment marker produced by the summary step. */
export interface LiveSessionTimestamp {
  /** Seconds from the start of the recording. */
  time: number;
  label: string;
}

export interface LiveSession {
  id: string;
  assignment_id: string;
  classroom_id: string;
  syllabus_section_id: string | null;
  session_type: LiveSessionType;
  status: LiveSessionStatus;
  video_temp_path: string | null;
  audio_path: string | null;
  audio_chunk_paths: string[];
  duration_seconds: number | null;
  transcript: string | null;
  summary: string | null;
  timestamps: LiveSessionTimestamp[];
  error: string | null;
  created_at: string;
  updated_at: string;
}

export const LIVE_SESSION_TYPES: LiveSessionType[] = ['workshop', 'lecture', 'practice'];
