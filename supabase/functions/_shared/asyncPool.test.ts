/**
 * Tests for asyncPool helper.
 * Run with: deno test supabase/functions/_shared/asyncPool.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { runPool } from './asyncPool.ts';

Deno.test('runPool preserves order when concurrency exceeds item count', async () => {
  const result = await runPool([10, 20, 30], 5, async (x) => x + 1);
  assertEquals(result, [11, 21, 31]);
});

Deno.test('runPool respects concurrency cap', async () => {
  let concurrent = 0;
  let maxConcurrent = 0;
  const nums = [...Array.from({ length: 12 }).keys()];
  await runPool(nums, 3, async (x) => {
    concurrent++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    concurrent--;
    return x * 2;
  });
  assertEquals(maxConcurrent <= 3, true);
});

Deno.test('runPool returns empty for empty items', async () => {
  const result = await runPool([], 4, async () => 1);
  assertEquals(result, []);
});
