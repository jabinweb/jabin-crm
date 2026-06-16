import { describe, test, expect } from '@jest/globals';
import { consumeRateLimit } from '../rate-limit-store';

describe('consumeRateLimit (memory fallback)', () => {
  test('allows requests under the limit', async () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const opts = { windowMs: 60_000, maxRequests: 3 };
    expect(await consumeRateLimit(key, opts)).toBe(true);
    expect(await consumeRateLimit(key, opts)).toBe(true);
    expect(await consumeRateLimit(key, opts)).toBe(true);
  });

  test('blocks when limit exceeded', async () => {
    const key = `test-block-${Date.now()}-${Math.random()}`;
    const opts = { windowMs: 60_000, maxRequests: 2 };
    expect(await consumeRateLimit(key, opts)).toBe(true);
    expect(await consumeRateLimit(key, opts)).toBe(true);
    expect(await consumeRateLimit(key, opts)).toBe(false);
  });
});
