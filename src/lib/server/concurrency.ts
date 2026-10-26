export async function mapSettled<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const output: PromiseSettledResult<R>[] = [];
  let cursor = 0;
  await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        try {
          output[index] = {
            status: "fulfilled",
            value: await fn(items[index]),
          };
        } catch (reason) {
          output[index] = { status: "rejected", reason };
        }
      }
    }),
  );
  return output;
}
