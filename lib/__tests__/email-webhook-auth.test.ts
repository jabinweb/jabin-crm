import { describe, test, expect, afterEach } from '@jest/globals';
import { verifyEmailWebhookSecret } from '../email-webhook-auth';

function mockRequest(headers: Record<string, string> = {}) {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    headers: {
      get: (name: string) => normalized[name.toLowerCase()] ?? null,
    },
  } as Parameters<typeof verifyEmailWebhookSecret>[0];
}

describe('verifyEmailWebhookSecret', () => {
  const original = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;

  afterEach(() => {
    if (original === undefined) delete process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
    else process.env.INBOUND_EMAIL_WEBHOOK_SECRET = original;
  });

  test('allows when secret is not configured', () => {
    delete process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
    expect(verifyEmailWebhookSecret(mockRequest())).toBe(true);
  });

  test('rejects missing header when secret is set', () => {
    process.env.INBOUND_EMAIL_WEBHOOK_SECRET = 'test-secret';
    expect(verifyEmailWebhookSecret(mockRequest())).toBe(false);
  });

  test('accepts Bearer token', () => {
    process.env.INBOUND_EMAIL_WEBHOOK_SECRET = 'test-secret';
    expect(
      verifyEmailWebhookSecret(mockRequest({ authorization: 'Bearer test-secret' }))
    ).toBe(true);
  });
});
