export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function withExpBackoff<T>(
  fn: () => Promise<T>,
  shouldRetry: (e: any) => boolean,
  { retries = 4, base = 250 }: { retries?: number; base?: number } = {}
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries || !shouldRetry(e)) throw e;
      const wait = Math.round(base * Math.pow(2, attempt) + Math.random() * 100);
      await sleep(wait);
      attempt++;
    }
  }
}
