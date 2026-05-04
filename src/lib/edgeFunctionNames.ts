/**
 * Deployed Supabase Edge Function names (folder names under supabase/functions).
 * Keep in sync when adding functions; used for Monitoring logs filter dropdown.
 */
export const EDGE_FUNCTION_NAMES = [
  'admin-monitoring-probe',
  'admin-vercel-insights',
  'analyze-student-wellbeing',
  'collect-metric-snapshot',
  'compute-nuance-insights',
  'delete-user-account',
  'evaluate-from-feedback',
  'explain-analytics-5d',
  'generate-feedback',
  'generate-followup-assignment',
  'generate-student-facing-task',
  'perleap-chat',
  'regenerate-scores',
  'rephrase-text',
  'speech-to-text',
  'suggest-assignment-hard-skills',
  'teacher-assistant-chat',
  'text-to-speech',
] as const;

export type EdgeFunctionName = (typeof EDGE_FUNCTION_NAMES)[number];
