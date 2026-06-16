import { describe, test, expect, beforeEach, afterAll } from '@jest/globals';

describe('Production environment validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function baseEnv() {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.AUTH_SECRET = 'a'.repeat(32);
    process.env.AUTH_URL = 'https://app.example.com';
    process.env.ENCRYPTION_KEY = 'b'.repeat(32);
    process.env.GOOGLE_CLIENT_ID = 'google-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'mail@example.com';
    process.env.SMTP_PASSWORD = 'secret';
    process.env.SMTP_FROM = 'mail@example.com';
    process.env.RAZORPAY_TEST_KEY_ID = 'rzp_test';
    process.env.RAZORPAY_TEST_KEY_SECRET = 'rzp_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
    process.env.CRON_SECRET = 'cron-secret-min-16';
  }

  test('passes with full production config', () => {
    baseEnv();
    const { validateEnv } = require('../env-validation');
    expect(() => validateEnv()).not.toThrow();
  });

  test('fails without Razorpay webhook secret in production', () => {
    baseEnv();
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const { validateEnv } = require('../env-validation');
    expect(() => validateEnv()).toThrow();
  });

  test('fails without SMTP in production when EMAIL_PROVIDER=smtp', () => {
    baseEnv();
    delete process.env.SMTP_HOST;
    const { validateEnv } = require('../env-validation');
    expect(() => validateEnv()).toThrow();
  });
});
