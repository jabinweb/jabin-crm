import { describe, expect, it } from '@jest/globals';
import { avatarSrc, gravatarUrl, initialsOf, md5Hex } from '@/lib/avatar';

describe('md5Hex', () => {
  it('matches the RFC 1321 test vectors', () => {
    expect(md5Hex('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5Hex('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5Hex('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0');
    expect(md5Hex('12345678901234567890123456789012345678901234567890123456789012345678901234567890')).toBe(
      '57edf4a22be3c955ac49da2e2107b67a'
    );
  });
});

describe('gravatarUrl', () => {
  it('hashes the trimmed, lower-cased email', () => {
    // Gravatar's documented example
    expect(gravatarUrl('  MyEmailAddress@example.com ')).toContain('0bc83cb571cd1c50ba6f3e8a78ef1346');
    expect(gravatarUrl('a@b.co', 40)).toMatch(/[?&]d=404/);
  });

  it('returns null without a usable email', () => {
    expect(gravatarUrl(null)).toBeNull();
    expect(gravatarUrl('not-an-email')).toBeNull();
  });
});

describe('avatarSrc', () => {
  it('prefers the person’s own image over Gravatar', () => {
    expect(avatarSrc({ image: 'https://cdn.test/me.png', email: 'a@b.co' })).toBe('https://cdn.test/me.png');
    expect(avatarSrc({ image: '/avatars/default.png', email: 'a@b.co' })).toContain('gravatar.com');
    expect(avatarSrc({ name: 'No email' })).toBeUndefined();
  });
});

describe('initialsOf', () => {
  it('uses first and last name, falling back to the email', () => {
    expect(initialsOf('Harshit Singh')).toBe('HS');
    expect(initialsOf('rachel')).toBe('RA');
    expect(initialsOf(null, 'jason.miller@example.com')).toBe('JM');
    expect(initialsOf(null, null)).toBe('?');
  });
});
