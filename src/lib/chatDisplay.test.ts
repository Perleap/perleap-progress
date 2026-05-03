import { describe, expect, it } from 'vitest';
import {
  formatInlineListsForChatMarkdown,
  splitAssistantMessageIntoSentences,
  splitChatDisplayText,
} from '@/lib/chatDisplay';

const SCREENSHOT_LIKE =
  "Hey, I need your help with something. Don't overthink it, just answer 3 things: 1) What should it do? 2) What should it not do? 3) What's one thing you'd want to ask me before building anything?";

describe('formatInlineListsForChatMarkdown', () => {
  it('splits run-in 1) 2) 3) after a colon (screenshot case)', () => {
    const out = formatInlineListsForChatMarkdown(SCREENSHOT_LIKE);
    expect(out).toContain('things:\n1)');
    expect(out).toContain('\n2)');
    expect(out).toContain('\n3)');
  });

  it('leaves pre-formatted two-paragraph list unchanged in spirit', () => {
    const input = 'Intro line.\n\n1) First\n2) Second';
    const out = formatInlineListsForChatMarkdown(input);
    expect(out).toBe('Intro line.\n\n1) First\n2) Second');
  });

  it('does not split a single 1) fragment without a list sibling', () => {
    const input = 'Only one marker 1) here.';
    const out = formatInlineListsForChatMarkdown(input);
    expect(out).toBe('Only one marker 1) here.');
  });

  it('does not treat version 1) and 2) mid-sentence as a consecutive list (no list context)', () => {
    const input = 'See version 1) and 2) in the doc.';
    const out = formatInlineListsForChatMarkdown(input);
    expect(out).toBe('See version 1) and 2) in the doc.');
  });

  it('splits 1) a 2) b at paragraph start (list context)', () => {
    const input = '1) What? 2) When? 3) Where?';
    const out = formatInlineListsForChatMarkdown(input);
    expect(out).toBe('1) What?\n2) When?\n3) Where?');
  });

  it('adds newline before bullet after colon for run-in', () => {
    const input = 'Pick one: - apples - oranges';
    const out = formatInlineListsForChatMarkdown(input);
    expect(out).toContain(':\n- apples');
  });

  it('is stable when applied twice to the same string', () => {
    const once = formatInlineListsForChatMarkdown(SCREENSHOT_LIKE);
    const twice = formatInlineListsForChatMarkdown(once);
    expect(twice).toBe(once);
  });
});

describe('formatInlineListsForChatMarkdown + splitChatDisplayText', () => {
  it('after run-in, splitChatDisplayText can yield intro + list as two segments (first single newline rule)', () => {
    const norm = formatInlineListsForChatMarkdown(SCREENSHOT_LIKE);
    const parts = splitChatDisplayText(norm);
    expect(parts.length).toBe(2);
    expect(parts[0]).toMatch(/things:\s*$/);
    expect(parts[1].trimStart()).toMatch(/^1\)/);
  });
});

describe('splitAssistantMessageIntoSentences', () => {
  it('returns empty for blank', () => {
    expect(splitAssistantMessageIntoSentences('')).toEqual([]);
    expect(splitAssistantMessageIntoSentences('   ')).toEqual([]);
  });

  it('splits English sentences on period / question / exclamation', () => {
    expect(splitAssistantMessageIntoSentences('Hello. World! How?')).toEqual(['Hello.', 'World!', 'How?']);
  });

  it('consumes runs of terminators and trailing space', () => {
    expect(splitAssistantMessageIntoSentences('Wait... Really.  Next')).toEqual(['Wait...', 'Really.', 'Next']);
  });

  it('keeps one segment when no terminator is followed by whitespace (e.g. compact !)', () => {
    expect(splitAssistantMessageIntoSentences('Hi!Are you ok')).toEqual(['Hi!Are you ok']);
  });

  it('handles Hebrew sof pasuq as sentence end', () => {
    const t = 'משפט אחד׃ משפט שני';
    expect(splitAssistantMessageIntoSentences(t)).toEqual(['משפט אחד׃', 'משפט שני']);
  });

  it('splits after newline following terminator', () => {
    expect(splitAssistantMessageIntoSentences('First.\nSecond sentence.')).toEqual(['First.', 'Second sentence.']);
  });
});
