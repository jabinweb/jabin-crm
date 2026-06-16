import type { NextRequest } from 'next/server';

/**
 * Optional shared secret for inbound/reply email webhooks.
 * When INBOUND_EMAIL_WEBHOOK_SECRET is set, callers must send
 * `Authorization: Bearer <secret>` or `x-webhook-secret: <secret>`.
 */
export function verifyEmailWebhookSecret(request: NextRequest): boolean {
  const secret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (!secret) return true;
  const header =
    request.headers.get('x-webhook-secret') || request.headers.get('authorization');
  return header === secret || header === `Bearer ${secret}`;
}
