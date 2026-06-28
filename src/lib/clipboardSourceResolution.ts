import { splitAssistantMessageIntoSentences } from '@/lib/chatDisplay';
import type { ClipboardSourceKind } from '@/services/clipboardEventService';

export interface ResolvedClipboardCopy {
  copiedText: string;
  sourceKind: ClipboardSourceKind;
  messageIndex?: number;
  sentenceIndex?: number;
  sentenceText?: string;
  contextKey?: string;
}

const ZONE_ATTR = 'data-clipboard-zone';
const MESSAGE_INDEX_ATTR = 'data-clipboard-message-index';
const CONTEXT_KEY_ATTR = 'data-clipboard-context-key';

function findZoneElement(node: Node | null): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement && current.hasAttribute(ZONE_ATTR)) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

function parseSourceKind(raw: string | null): ClipboardSourceKind {
  const allowed: ClipboardSourceKind[] = [
    'assistant_message',
    'user_message',
    'chat_input',
    'student_facing_task',
    'assignment_instructions',
    'essay',
    'test_answer',
    'langchain_field',
    'page_unknown',
  ];
  if (raw && allowed.includes(raw as ClipboardSourceKind)) {
    return raw as ClipboardSourceKind;
  }
  return 'page_unknown';
}

function resolveAssistantSentence(
  messageIndex: number,
  copiedText: string,
  zoneEl: HTMLElement,
): Pick<ResolvedClipboardCopy, 'sentenceIndex' | 'sentenceText'> {
  const rawContent = zoneEl.getAttribute('data-clipboard-message-content') ?? copiedText;
  const sentences = splitAssistantMessageIntoSentences(rawContent);
  if (sentences.length === 0) {
    return { sentenceIndex: 0, sentenceText: copiedText.trim() };
  }

  const needle = copiedText.trim().toLowerCase();
  let bestIdx = 0;
  let bestScore = -1;

  for (let si = 0; si < sentences.length; si++) {
    const sent = sentences[si];
    const lower = sent.toLowerCase();
    if (lower === needle) return { sentenceIndex: si, sentenceText: sent };
    if (lower.includes(needle) || needle.includes(lower)) {
      const score = Math.min(lower.length, needle.length);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = si;
      }
    }
  }

  return { sentenceIndex: bestIdx, sentenceText: sentences[bestIdx] };
}

/**
 * Resolve a copy event from the current selection within a marked assignment workspace.
 */
export function resolveClipboardCopyFromSelection(
  root: HTMLElement | null,
): ResolvedClipboardCopy | null {
  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  if (!selection || selection.isCollapsed) return null;

  const copiedText = selection.toString();
  if (!copiedText.trim()) return null;

  const anchorNode = selection.anchorNode;
  if (!anchorNode) return null;

  if (root && !root.contains(anchorNode)) return null;

  const zoneEl = findZoneElement(anchorNode);
  const sourceKind = parseSourceKind(zoneEl?.getAttribute(ZONE_ATTR) ?? null);

  const messageIndexRaw = zoneEl?.getAttribute(MESSAGE_INDEX_ATTR);
  const messageIndex =
    messageIndexRaw != null && messageIndexRaw !== '' ? Number(messageIndexRaw) : undefined;

  const contextKey = zoneEl?.getAttribute(CONTEXT_KEY_ATTR) ?? undefined;

  const base: ResolvedClipboardCopy = {
    copiedText: copiedText.trim(),
    sourceKind,
    contextKey: contextKey || undefined,
    messageIndex: Number.isFinite(messageIndex) ? messageIndex : undefined,
  };

  if (sourceKind === 'assistant_message' && zoneEl && base.messageIndex != null) {
    const { sentenceIndex, sentenceText } = resolveAssistantSentence(
      base.messageIndex,
      copiedText,
      zoneEl,
    );
    return { ...base, sentenceIndex, sentenceText };
  }

  return base;
}

export const CLIPBOARD_ZONE_ATTRS = {
  zone: ZONE_ATTR,
  messageIndex: MESSAGE_INDEX_ATTR,
  contextKey: CONTEXT_KEY_ATTR,
} as const;

export function clipboardZoneProps(params: {
  sourceKind: ClipboardSourceKind;
  messageIndex?: number;
  contextKey?: string;
  messageContent?: string;
}): Record<string, string> {
  const props: Record<string, string> = {
    [ZONE_ATTR]: params.sourceKind,
  };
  if (params.messageIndex != null) {
    props[MESSAGE_INDEX_ATTR] = String(params.messageIndex);
  }
  if (params.contextKey) {
    props[CONTEXT_KEY_ATTR] = params.contextKey;
  }
  if (params.messageContent) {
    props['data-clipboard-message-content'] = params.messageContent;
  }
  return props;
}
