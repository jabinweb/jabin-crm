import type Redis from 'ioredis';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

interface MemoryBucket {
  count: number;
  timestamp: number;
}

const memoryCache = new Map<string, MemoryBucket>();

let redisClient: Redis | null = null;
let redisInitAttempted = false;

async function getRedisClient(): Promise<Redis | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (redisClient) return redisClient;
  if (redisInitAttempted) return null;

  redisInitAttempted = true;
  try {
    const { default: IORedis } = await import('ioredis');
    redisClient = new IORedis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    await redisClient.connect();
    return redisClient;
  } catch {
    redisClient = null;
    return null;
  }
}

async function checkRedisLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return checkMemoryLimit(key, windowMs, maxRequests);

  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `rl:${key}`;

  const count = await client.incr(redisKey);
  if (count === 1) {
    await client.expire(redisKey, windowSec);
  }
  return count <= maxRequests;
}

function checkMemoryLimit(key: string, windowMs: number, maxRequests: number): boolean {
  const now = Date.now();
  const bucket = memoryCache.get(key) ?? { count: 0, timestamp: now };

  if (now - bucket.timestamp > windowMs) {
    bucket.count = 0;
    bucket.timestamp = now;
  }

  bucket.count++;
  memoryCache.set(key, bucket);
  return bucket.count <= maxRequests;
}

/** Returns true when the request is allowed, false when rate limited. */
export async function consumeRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<boolean> {
  return checkRedisLimit(key, options.windowMs, options.maxRequests);
}

export function rateLimitKeyFromIp(ip: string, pathname: string): string {
  return `${ip}:${pathname.split('?')[0]}`;
}
