/**
 * @jest-environment node
 */
import {
  bearerTokenFromHeader,
  formatMcpToken,
  generateMcpSecret,
  hashMcpSecret,
  parseMcpToken,
  parseMcpTokenExpiryDays,
  parseMcpTokenScope,
  verifyMcpSecret,
} from '@/lib/mcp/token-format';

describe('MCP token format', () => {
  it('round-trips a generated token', () => {
    const secret = generateMcpSecret();
    const token = formatMcpToken('clx1abc2def3ghi4', secret);
    expect(token.startsWith('opl_clx1abc2def3ghi4_')).toBe(true);
    expect(parseMcpToken(token)).toEqual({ recordId: 'clx1abc2def3ghi4', secret });
  });

  it('keeps underscores and dashes in the secret', () => {
    const secret = 'ab_cd-ef_gh-ij_kl-mn_op-qr_st-uv_wx-yz';
    expect(parseMcpToken(`opl_clx1abc2def3ghi4_${secret}`)).toEqual({
      recordId: 'clx1abc2def3ghi4',
      secret,
    });
  });

  it('rejects malformed tokens', () => {
    for (const bad of [
      null,
      undefined,
      '',
      'opl_',
      'opl__secret',
      'sk-ant-whatever',
      'opl_UPPERCASEID_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'opl_clx1abc2def3ghi4_short',
      'opl_clx1abc2def3ghi4_has spaces in it aaaaaaaaaaaaaaaaaaaaaaaaa',
      `opl_clx1abc2def3ghi4_${'a'.repeat(300)}`,
    ]) {
      expect(parseMcpToken(bad as string)).toBeNull();
    }
  });

  it('verifies only the matching secret against the stored hash', () => {
    const secret = generateMcpSecret();
    const hash = hashMcpSecret(secret);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(secret);
    expect(verifyMcpSecret(secret, hash)).toBe(true);
    expect(verifyMcpSecret(generateMcpSecret(), hash)).toBe(false);
    expect(verifyMcpSecret(secret, null)).toBe(false);
    expect(verifyMcpSecret(secret, 'not-a-hash')).toBe(false);
  });

  it('generates distinct high-entropy secrets', () => {
    const a = generateMcpSecret();
    const b = generateMcpSecret();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  it('reads bearer tokens from the Authorization header', () => {
    expect(bearerTokenFromHeader('Bearer opl_abc_def')).toBe('opl_abc_def');
    expect(bearerTokenFromHeader('bearer   opl_abc_def ')).toBe('opl_abc_def');
    expect(bearerTokenFromHeader('Basic abc')).toBeNull();
    expect(bearerTokenFromHeader(null)).toBeNull();
  });

  it('defaults scope to read-only and expiry to an allowed value', () => {
    expect(parseMcpTokenScope('read_write')).toBe('read_write');
    expect(parseMcpTokenScope('admin')).toBe('read');
    expect(parseMcpTokenScope(undefined)).toBe('read');
    expect(parseMcpTokenExpiryDays(365)).toBe(365);
    expect(parseMcpTokenExpiryDays('30')).toBe(30);
    expect(parseMcpTokenExpiryDays(10_000)).toBe(90);
  });
});
