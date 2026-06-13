/**
 * Tests for evaluation validation helpers.
 * Run with: deno test supabase/functions/_shared/evaluationValidation.test.ts
 */

import {
  assertEquals,
  assertAlmostEquals,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  evidenceQuoteInSource,
  levelToScore,
  meanNonNullScores,
  normalizeDimension,
  normalizeEvaluationPayload,
  clampScore,
} from './evaluationValidation.ts';

Deno.test('levelToScore maps rubric levels to 1-10 scale', () => {
  assertEquals(levelToScore(1), 2);
  assertEquals(levelToScore(3), 6);
  assertEquals(levelToScore(5), 10);
});

Deno.test('clampScore bounds and rounds', () => {
  assertEquals(clampScore(0.4), 1);
  assertEquals(clampScore(7), 7);
  assertEquals(clampScore(7.6), 8);
  assertEquals(clampScore(null), null);
});

Deno.test('normalizeEvaluationPayload preserves odd scores from model', () => {
  const result = normalizeEvaluationPayload(
    {
      dimensions: {
        vision: {
          level: null,
          score: 7,
          notAssessableReason: null,
          evidence: ['Student: 2'],
          explanation: 'Clean correct work',
        },
        values: {
          level: null,
          score: null,
          notAssessableReason: 'No values signal in arithmetic drill',
          evidence: [],
          explanation: '',
        },
        thinking: {
          level: null,
          score: 5,
          notAssessableReason: null,
          evidence: ['Student: 2'],
          explanation: 'Basic reasoning only',
        },
        connection: {
          level: null,
          score: 6,
          notAssessableReason: null,
          evidence: ['Student: 2'],
          explanation: 'Clear short answers',
        },
        action: {
          level: null,
          score: 7,
          notAssessableReason: null,
          evidence: ['Student: 2'],
          explanation: 'All requirements met cleanly',
        },
      },
      studentFeedback: 'Good',
      teacherFeedback: 'Fine',
    },
    'Student: 2',
    { requireEvidence: false },
  );

  assertEquals(result.scores.vision, 7);
  assertEquals(result.scores.thinking, 5);
  assertEquals(result.scores.connection, 6);
  assertEquals(result.scores.action, 7);
  assertEquals(result.scores.values, null);
});

Deno.test('normalizeDimension falls back to levelToScore when score is null', () => {
  const result = normalizeEvaluationPayload(
    {
      dimensions: {
        vision: {
          level: 3,
          score: null,
          notAssessableReason: null,
          evidence: [],
          explanation: 'Legacy level only',
        },
        values: { level: null, score: null, notAssessableReason: 'N/A', evidence: [], explanation: '' },
        thinking: { level: null, score: null, notAssessableReason: 'N/A', evidence: [], explanation: '' },
        connection: { level: null, score: null, notAssessableReason: 'N/A', evidence: [], explanation: '' },
        action: { level: null, score: null, notAssessableReason: 'N/A', evidence: [], explanation: '' },
      },
      studentFeedback: '',
      teacherFeedback: '',
    },
    'source text',
    { requireEvidence: false },
  );

  assertEquals(result.scores.vision, 6);
});

Deno.test('evidenceQuoteInSource finds normalized quotes', () => {
  const source = 'Student: I think the answer is 42 because of the pattern.';
  assertEquals(
    evidenceQuoteInSource('the answer is 42', source),
    true,
  );
  assertEquals(
    evidenceQuoteInSource('completely unrelated', source),
    false,
  );
});

Deno.test('evidenceQuoteInSource verifies short numeric answers with word boundaries', () => {
  assertEquals(evidenceQuoteInSource('4', 'Student: 4'), true);
  assertEquals(evidenceQuoteInSource('4', 'Student: 42'), false);
  assertEquals(evidenceQuoteInSource('1', 'Agent: What is 2+2?\n\nStudent: 1'), true);
});

Deno.test('evidenceQuoteInSource is punctuation-insensitive', () => {
  const source = 'The answer is: 42.';
  assertEquals(evidenceQuoteInSource('the answer is 42', source), true);
});

Deno.test('normalizeDimension drops unverified evidence without mutating explanation', () => {
  const result = normalizeDimension(
    {
      score: 7,
      evidence: ['Student invented this quote'],
      explanation: 'All requirements met cleanly.',
    },
    'Student: 4\n\nStudent: 1\n\nStudent: 0',
    true,
  );
  assertEquals(result.score, 7);
  assertEquals(result.explanation, 'All requirements met cleanly.');
  assertEquals(result.evidence, []);
});

Deno.test('normalizeDimension keeps verified short evidence', () => {
  const result = normalizeDimension(
    {
      score: 7,
      evidence: ['4'],
      explanation: 'Correct answer to multiplication.',
    },
    'Agent: 2×2?\n\nStudent: 4',
    true,
  );
  assertEquals(result.score, 7);
  assertEquals(result.evidence, ['4']);
});

Deno.test('normalizeEvaluationPayload handles not assessable dimension', () => {
  const result = normalizeEvaluationPayload(
    {
      dimensions: {
        vision: {
          level: null,
          score: null,
          notAssessableReason: 'No collaboration in solo essay',
          evidence: [],
          explanation: '',
        },
        values: {
          level: 3,
          score: 6,
          notAssessableReason: null,
          evidence: ['Student wrote about fairness'],
          explanation: 'Shows judgment',
        },
        thinking: {
          level: 4,
          score: 8,
          notAssessableReason: null,
          evidence: ['because of the pattern'],
          explanation: 'Strong reasoning',
        },
        connection: {
          level: null,
          score: null,
          notAssessableReason: 'Solo essay',
          evidence: [],
          explanation: '',
        },
        action: {
          level: 3,
          score: 6,
          notAssessableReason: null,
          evidence: ['completed all parts'],
          explanation: 'Adequate execution',
        },
      },
      studentFeedback: 'Good job',
      teacherFeedback: 'Watch reasoning',
    },
    'Student wrote about fairness because of the pattern and completed all parts',
  );

  assertEquals(result.scores.vision, null);
  assertEquals(result.scores.thinking, 8);
  assertEquals(result.scoreExplanations.vision, 'No collaboration in solo essay');
});

Deno.test('meanNonNullScores skips null dimensions', () => {
  const mean = meanNonNullScores({
    vision: null,
    values: 4,
    thinking: 8,
    connection: null,
    action: 6,
  });
  assertAlmostEquals(mean!, 6, 0.001);
});
