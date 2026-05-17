/** Run async work over `items` with at most `concurrency` workers in parallel. Results match `items` order. */
export async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  const cap = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]!, i);
    }
  }

  await Promise.all(Array.from({ length: cap }, () => runWorker()));
  return results;
}
