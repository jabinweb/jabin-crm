import type { NextRequest } from 'next/server';
import {
  consumeRateLimit,
  rateLimitKeyFromIp,
  type RateLimitOptions,
} from './rate-limit-store';

export type { RateLimitOptions } from './rate-limit-store';

/**
 * Rate limit helper used by proxy.
 * Uses Redis when REDIS_URL is set; otherwise in-memory (single instance only).
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<{ success: boolean }> {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';
  const key = rateLimitKeyFromIp(ip, req.nextUrl.pathname);
  const allowed = await consumeRateLimit(key, options);
  if (!allowed) {
    throw new Error('Rate limit exceeded');
  }
  return { success: true };
}
