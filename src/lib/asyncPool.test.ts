import { describe, expect, it, vi } from 'vitest';
import { runPool } from '@/lib/asyncPool';

describe('runPool', () => {
  it('runs all items preserving order when concurrency is greater than length', async () => {
    const result = await runPool([10, 20, 30], 5, async (x) => x + 1);
    expect(result).toEqual([11, 21, 31]);
  });

  it('respects concurrency (max parallel in-flight)', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const worker = vi.fn(async (x: number) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise<void>((resolve) => {
        queueMicrotask(resolve);
      });
      concurrent--;
      return x * 2;
    });
    const nums = [...Array.from({ length: 12 }).keys()];
    await runPool(nums, 3, worker);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
    expect(worker).toHaveBeenCalledTimes(12);
  });

  it('returns empty for empty items', async () => {
    const worker = vi.fn(async () => 1);
    await expect(runPool([], 4, worker)).resolves.toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it('floors concurrency to at least 1', async () => {
    const spy = vi.fn(async (x: number) => x);
    await runPool([1, 2], 0, spy);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
