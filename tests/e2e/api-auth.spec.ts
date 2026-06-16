import { test, expect } from '@playwright/test';

const base = process.env.PLAYWRIGHT_BASE_URL || process.env.STAGING_BASE_URL;

test.describe('API authentication', () => {
  test.skip(!base, 'Set PLAYWRIGHT_BASE_URL or STAGING_BASE_URL');

  test('GET /api/features/me requires auth', async ({ request }) => {
    const res = await request.get(`${base}/api/features/me`);
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/leads requires auth', async ({ request }) => {
    const res = await request.get(`${base}/api/leads`);
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/tickets requires auth', async ({ request }) => {
    const res = await request.get(`${base}/api/tickets`);
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/employee/attendance requires employee session', async ({ request }) => {
    const res = await request.get(`${base}/api/employee/attendance`);
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/leave-requests requires admin auth', async ({ request }) => {
    const res = await request.get(`${base}/api/leave-requests`);
    expect([401, 403]).toContain(res.status());
  });
});
