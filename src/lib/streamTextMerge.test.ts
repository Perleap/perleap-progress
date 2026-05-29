import { describe, expect, it } from 'vitest';
import { mergeStreamingTextChunk } from './streamTextMerge';

describe('mergeStreamingTextChunk', () => {
  it('never inserts space between bare letter runs', () => {
    expect(mergeStreamingTextChunk('multip', 'lication')).toBe('multiplication');
    expect(mergeStreamingTextChunk('abcdef', 'ghij')).toBe('abcdefghij');
  });

  it('preserves chunk leading space from the API', () => {
    expect(mergeStreamingTextChunk('word', ' next')).toBe('word next');
  });

  it('does not break PROGRESS markers across chunks', () => {
    expect(mergeStreamingTextChunk('<<<PRO', 'GRESS:[1]>>>')).toBe('<<<PROGRESS:[1]>>>');
  });

  it('does not insert space for glued word chunks (accepted trade-off)', () => {
    expect(mergeStreamingTextChunk('addition', 'part')).toBe('additionpart');
  });
});
