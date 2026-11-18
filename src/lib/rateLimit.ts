const hits = new Map<string, number>();

/** Returns true at most once per `ms` window for the given key; records the hit. */
export function rateLimited(key: string, ms: number, now = Date.now()): boolean {
  const last = hits.get(key) ?? -Infinity;
  if (now - last < ms) return false;
  hits.set(key, now);
  return true;
}

export function clearRateLimits(): void {
  hits.clear();
}

/** Leading-edge throttle: invokes `fn` at most once per `ms` window. */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let last = -Infinity;
  return (...args: A) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): ((...args: A) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: A) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, ms);
  };
  wrapped.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return wrapped;
}
