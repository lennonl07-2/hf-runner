const entries = new Map<string, { expires: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
export async function cached<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>,
): Promise<T> {
  const entry = entries.get(key);
  if (entry && entry.expires > Date.now()) return entry.value as T;
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn()
    .then((value) => {
      if (entries.size >= 500) entries.delete(entries.keys().next().value!);
      entries.set(key, { expires: Date.now() + ttl, value });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
