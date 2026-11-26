/** Abort the underlying request rather than leaving a synchronization flight stuck. */
export async function withRequestTimeout<T>(request: (signal: AbortSignal) => PromiseLike<T>, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await request(controller.signal); }
  finally { clearTimeout(timer); }
}
