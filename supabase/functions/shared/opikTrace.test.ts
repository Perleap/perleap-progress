/**
 * Tests for Opik cost-tracking helpers: token usage normalization and manual
 * cost estimation. Run with: `deno test supabase/functions/shared/`.
 */

import {
  assertEquals,
  assertAlmostEquals,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  estimateLlmCostUsd,
  normalizeOpikTokenUsage,
} from './opikTrace.ts';

Deno.test('normalizeOpikTokenUsage: OpenAI Chat Completions shape', () => {
  assertEquals(
    normalizeOpikTokenUsage({
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    }),
    { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  );
});

Deno.test('normalizeOpikTokenUsage: Chat shape derives total when missing', () => {
  assertEquals(
    normalizeOpikTokenUsage({ prompt_tokens: 4, completion_tokens: 6 }),
    { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 },
  );
});

Deno.test('normalizeOpikTokenUsage: OpenAI Responses API shape', () => {
  assertEquals(
    normalizeOpikTokenUsage({
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
    }),
    { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  );
});

Deno.test('normalizeOpikTokenUsage: Gemini / Google AI shape', () => {
  assertEquals(
    normalizeOpikTokenUsage({
      promptTokenCount: 12,
      candidatesTokenCount: 8,
      totalTokenCount: 20,
    }),
    { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
  );
});

Deno.test('normalizeOpikTokenUsage: returns null for unrecognized / garbage', () => {
  assertEquals(normalizeOpikTokenUsage(null), null);
  assertEquals(normalizeOpikTokenUsage(undefined), null);
  assertEquals(normalizeOpikTokenUsage('nope'), null);
  assertEquals(normalizeOpikTokenUsage({ foo: 'bar' }), null);
});

Deno.test('estimateLlmCostUsd: gpt-5.5 standard pricing', () => {
  const cost = estimateLlmCostUsd('gpt-5.5', {
    prompt_tokens: 1_000_000,
    completion_tokens: 1_000_000,
    total_tokens: 2_000_000,
  });
  // $5/1M input + $30/1M output = $35
  assertAlmostEquals(cost ?? -1, 35, 1e-9);
});

Deno.test('estimateLlmCostUsd: gpt-4o-mini pricing', () => {
  const cost = estimateLlmCostUsd('gpt-4o-mini', {
    prompt_tokens: 1_000_000,
    completion_tokens: 1_000_000,
    total_tokens: 2_000_000,
  });
  // $0.15/1M input + $0.60/1M output = $0.75
  assertAlmostEquals(cost ?? -1, 0.75, 1e-9);
});

Deno.test('estimateLlmCostUsd: prefix match (e.g. dated model id)', () => {
  const cost = estimateLlmCostUsd('gpt-4o-mini-2024-07-18', {
    prompt_tokens: 1_000_000,
    completion_tokens: 0,
    total_tokens: 1_000_000,
  });
  assertAlmostEquals(cost ?? -1, 0.15, 1e-9);
});

Deno.test('estimateLlmCostUsd: unknown model returns undefined', () => {
  assertEquals(
    estimateLlmCostUsd('some-unlisted-model', {
      prompt_tokens: 10,
      completion_tokens: 10,
      total_tokens: 20,
    }),
    undefined,
  );
});

Deno.test('estimateLlmCostUsd: missing model or usage returns undefined', () => {
  assertEquals(estimateLlmCostUsd(undefined, null), undefined);
  assertEquals(
    estimateLlmCostUsd('gpt-5.5', null),
    undefined,
  );
});
