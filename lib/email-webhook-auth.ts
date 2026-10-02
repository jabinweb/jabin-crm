import type { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Shared secret for inbound/reply email webhooks.
 * When INBOUND_EMAIL_WEBHOOK_SECRET is set, callers must send
 * `Authorization: Bearer <secret>` or `x-webhook-secret: <secret>`.
 * In production the secret is required (fail closed); in development an
 * unset secret allows unauthenticated calls for local testing.
 */
export function verifyEmailWebhookSecret(request: NextRequest): boolean {
  const secret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const header =
    request.headers.get('x-webhook-secret') || request.headers.get('authorization');
  if (!header) return false;
  return safeEqual(header, secret) || safeEqual(header, `Bearer ${secret}`);
}
