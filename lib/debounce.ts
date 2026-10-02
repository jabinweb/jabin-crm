/** Trailing-edge debounce with `cancel()` (the lodash/debounce subset the app uses). */
export function debounce<A extends unknown[]>(fn: (...args: A) => unknown, waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void fn(...args);
    }, waitMs);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}
