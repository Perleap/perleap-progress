import { stripConversationCompleteMarker, stripProgressMarker } from '@/lib/chatDisplay';

/** Strip markdown markers for TTS playback. */
export function cleanTextForTTS(text: string): string {
  return stripProgressMarker(stripConversationCompleteMarker(text))
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/#{1,6}\s+(.*)/g, '$1')
    .replace(/`{1,3}([\s\S]*?)`{1,3}/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/\\/g, '')
    .trim();
}
