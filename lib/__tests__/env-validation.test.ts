import { describe, test, expect } from '@jest/globals';

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should pass validation with all required environment variables', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.AUTH_SECRET = 'a'.repeat(32);
    process.env.ENCRYPTION_KEY = 'b'.repeat(32);
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

    const { validateEnv } = require('../env-validation');

    expect(() => validateEnv()).not.toThrow();
  });

  test('should fail validation when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    process.env.AUTH_SECRET = 'a'.repeat(32);
    process.env.ENCRYPTION_KEY = 'b'.repeat(32);
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

    const { validateEnv } = require('../env-validation');

    expect(() => validateEnv()).toThrow();
  });

  test('should fail validation when AUTH_SECRET is too short', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.AUTH_SECRET = 'short';
    process.env.ENCRYPTION_KEY = 'b'.repeat(32);
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

    const { validateEnv } = require('../env-validation');

    expect(() => validateEnv()).toThrow();
  });

  test('should fail validation when ENCRYPTION_KEY is too short', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.AUTH_SECRET = 'a'.repeat(32);
    process.env.ENCRYPTION_KEY = 'short';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

    const { validateEnv } = require('../env-validation');

    expect(() => validateEnv()).toThrow();
  });
});
