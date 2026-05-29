/**
 * Concatenate streaming text chunks for chat display.
 * Do not insert spaces between bare letter runs — stream boundaries are arbitrary.
 * Keep in sync with supabase/functions/perleap-chat/typography.ts mergeStreamingTextChunk.
 */
export function mergeStreamingTextChunk(prev: string, chunk: string): string {
  if (!prev || !chunk) return prev + chunk;
  if (/[<>\[\]]/.test(chunk)) return prev + chunk;
  const window = prev.slice(-24) + chunk.slice(0, 24);
  if (/<<<|PROGRESS/i.test(window)) return prev + chunk;
  return prev + chunk;
}
