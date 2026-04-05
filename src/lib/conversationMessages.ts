import type { Message } from '@/types';

/**
 * Rehydrate fileContext from saved message content (matches student chat display).
 */
export function rehydrateMessages(msgs: Message[]): Message[] {
  return msgs.map((msg) => {
    if (msg.role !== 'user' || msg.fileContext) return msg;

    const attachmentMatch = msg.content.match(/\n\n--- Attached File: (.+?) ---\n([\s\S]*)$/);
    if (!attachmentMatch) return msg;

    const fileName = attachmentMatch[1];
    const fileBody = attachmentMatch[2];
    const cleanContent = msg.content.substring(0, attachmentMatch.index || 0);

    const urlMatch = fileBody.match(/\[File:\s*[^\]]+\]\s*URL:\s*(https?:\/\/\S+)/);
    if (urlMatch) {
      const url = urlMatch[1];
      const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
      return {
        ...msg,
        content: cleanContent,
        fileContext: { name: fileName, content: fileBody, url, type: isImage ? 'image' : 'pdf' },
      };
    }

    return {
      ...msg,
      content: cleanContent,
      fileContext: { name: fileName, content: fileBody, type: 'text' },
    };
  });
}
