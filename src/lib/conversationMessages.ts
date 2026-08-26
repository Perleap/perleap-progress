import type { Message } from '@/types';
import { stripConversationCompleteMarker, stripProgressMarker } from '@/lib/chatDisplay';

/**
 * Rehydrate fileContext from saved message content (matches student chat display).
 * Strips technical completion tokens from assistant text for display.
 */
export function rehydrateMessages(msgs: Message[]): Message[] {
  return msgs.map((msg) => {
    if (msg.role === 'assistant') {
      return {
        ...msg,
        content: stripProgressMarker(stripConversationCompleteMarker(String(msg.content ?? ''))),
      };
    }
    if (msg.role !== 'user' || msg.fileContext) return msg;

    const attachmentMatch = msg.content.match(/\n\n--- Attached File: (.+?) ---\n([\s\S]*)$/);
    if (!attachmentMatch) return msg;

    const fileName = attachmentMatch[1];
    const fileBody = attachmentMatch[2];
    const cleanContent = msg.content.substring(0, attachmentMatch.index || 0);

    const inferAttachmentType = (name: string, explicit?: string) => {
      if (explicit === 'image' || explicit === 'pdf') return explicit;
      if (/\.(jpg|jpeg|png|webp|gif)$/i.test(name)) return 'image';
      if (/\.pdf$/i.test(name)) return 'pdf';
      return 'text';
    };

    const storagePathMatch = fileBody.match(/Storage path:\s*(\S+)/);
    if (storagePathMatch) {
      const path = storagePathMatch[1];
      return {
        ...msg,
        content: cleanContent,
        fileContext: {
          name: fileName,
          content: fileBody,
          url: path,
          type: inferAttachmentType(fileName),
        },
      };
    }

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
