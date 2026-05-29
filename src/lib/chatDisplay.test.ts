import { describe, expect, it } from 'vitest';
import {
  formatInlineListsForChatMarkdown,
  isPerleapAssistantIntro,
  normalizePerleapIntroParagraphBreaks,
  splitAssistantMessageIntoSentences,
  splitChatDisplayText,
  splitExplainTaskDisplayText,
  splitPerleapIntroDisplayText,
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

  it('keeps course-recall prompt quotes in one bubble', () => {
    const t =
      "Yes, your final prompt was:\n\n# Email Organizer Agent\n\n**Goal**\n\nYou are an email organizer agent.";
    expect(splitChatDisplayText(t)).toEqual([t]);
  });

  it('splits multiple prose sentences on one line into separate display segments', () => {
    const t =
      "On, you used logic that is not fully stated in your prompt. Let's cover the gap: Where in your prompt does it say that an ambiguous email with unclear references should be replied to for clarification instead of being archived, escalated, or just marked medium? Can you add a rule to your prompt and paste the revised version?";
    const parts = splitChatDisplayText(formatInlineListsForChatMarkdown(t));
    expect(parts.length).toBe(3);
  });
});

describe('splitPerleapIntroDisplayText', () => {
  it('does not sentence-split the intro while streaming', () => {
    const partial = "Hello! I am Perleap, Dor Abookasis's AI teaching assistant";
    expect(splitPerleapIntroDisplayText(partial)).toEqual([partial]);
  });

  it('splits intro and question into separate bubbles on paragraph break', () => {
    const greeting =
      "Hello! I am Perleap, Dor Abookasis's AI teaching assistant.\n\nWhat is 1 + 1?";
    expect(splitPerleapIntroDisplayText(greeting)).toEqual([
      "Hello! I am Perleap, Dor Abookasis's AI teaching assistant.",
      'What is 1 + 1?',
    ]);
    expect(splitChatDisplayText(greeting)).toHaveLength(2);
  });

  it('normalizes a single newline after the intro line', () => {
    const singleNl =
      "Hello! I am Perleap, Dor Abookasis's AI teaching assistant.\nWhat is 1 + 1?";
    expect(normalizePerleapIntroParagraphBreaks(singleNl)).toContain('\n\n');
    expect(splitPerleapIntroDisplayText(singleNl)).toHaveLength(2);
  });
});

describe('splitExplainTaskDisplayText', () => {
  it('returns one segment for multi-sentence explain-task reply', () => {
    const t =
      'You will practice basic arithmetic with small numbers. Tell me when you are ready to start.';
    expect(splitExplainTaskDisplayText(t)).toEqual([t]);
    expect(splitChatDisplayText(t)).toHaveLength(2);
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
