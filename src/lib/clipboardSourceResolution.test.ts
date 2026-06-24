import { describe, expect, it } from 'vitest';
import { clipboardZoneProps } from '@/lib/clipboardSourceResolution';

describe('clipboardZoneProps', () => {
  it('builds data attributes for assistant message zones', () => {
    const props = clipboardZoneProps({
      sourceKind: 'assistant_message',
      messageIndex: 2,
      messageContent: 'Hello. World!',
    });
    expect(props['data-clipboard-zone']).toBe('assistant_message');
    expect(props['data-clipboard-message-index']).toBe('2');
    expect(props['data-clipboard-message-content']).toBe('Hello. World!');
  });

  it('includes context key for test answers', () => {
    const props = clipboardZoneProps({
      sourceKind: 'test_answer',
      contextKey: 'q-123',
    });
    expect(props['data-clipboard-zone']).toBe('test_answer');
    expect(props['data-clipboard-context-key']).toBe('q-123');
  });
});
