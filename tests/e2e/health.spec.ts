import { test, expect } from '@playwright/test';

const base = process.env.PLAYWRIGHT_BASE_URL || process.env.STAGING_BASE_URL;

test.describe('Health & public endpoints', () => {
  test.skip(!base, 'Set PLAYWRIGHT_BASE_URL or STAGING_BASE_URL');

  test('GET /api/health returns JSON status', async ({ request }) => {
    const res = await request.get(`${base}/api/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
  });

  test('GET /auth/signin loads', async ({ page }) => {
    await page.goto(`${base}/auth/signin`);
    await expect(page.getByRole('button', { name: /sign in|continue|google/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('POST /api/emails/reply rejects when webhook secret required', async ({ request }) => {
    test.skip(!process.env.INBOUND_EMAIL_WEBHOOK_SECRET, 'Secret not set in CI env');
    const res = await request.post(`${base}/api/emails/reply`, {
      data: { from: 'a@b.com', subject: 'Re: test' },
    });
    expect(res.status()).toBe(401);
  });
});
