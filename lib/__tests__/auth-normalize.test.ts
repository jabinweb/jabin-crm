import { describe, expect, it } from '@jest/globals';
import { normalizeAuthEmail } from '@/lib/auth/normalize-email';

describe('auth helpers', () => {
  it('normalizes email to lowercase', () => {
    expect(normalizeAuthEmail('  User@Example.COM ')).toBe('user@example.com');
  });
});
