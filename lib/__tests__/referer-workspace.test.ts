import { describe, expect, it } from '@jest/globals';
import { workspaceSlugFromReferer } from '@/lib/tenant/referer-workspace';

const host = 'opslane.example.com';

describe('workspaceSlugFromReferer', () => {
  it('reads the workspace from a same-origin page path', () => {
    expect(
      workspaceSlugFromReferer({ referer: `https://${host}/runmora/dashboard/projects/abc`, host })
    ).toBe('runmora');
    expect(workspaceSlugFromReferer({ referer: `https://${host}/Acme-Co/employee`, host })).toBe(
      'acme-co'
    );
  });

  it('ignores pages that are not inside a workspace', () => {
    for (const path of ['/', '/admin/users', '/portal/tickets', '/auth/signin', '/workspace', '/dashboard', '/pricing']) {
      expect(workspaceSlugFromReferer({ referer: `https://${host}${path}`, host })).toBeNull();
    }
  });

  it('ignores a referer from another origin', () => {
    expect(
      workspaceSlugFromReferer({ referer: 'https://evil.example/runmora/dashboard', host })
    ).toBeNull();
    expect(
      workspaceSlugFromReferer({ referer: `https://${host}.evil.example/runmora`, host })
    ).toBeNull();
  });

  it('handles missing or malformed input', () => {
    expect(workspaceSlugFromReferer({ referer: null, host })).toBeNull();
    expect(workspaceSlugFromReferer({ referer: 'not a url', host })).toBeNull();
    expect(workspaceSlugFromReferer({ referer: `https://${host}/runmora`, host: null })).toBeNull();
    expect(workspaceSlugFromReferer({ referer: `https://${host}/bad slug!/x`, host })).toBeNull();
  });

  it('uses the first forwarded host', () => {
    expect(
      workspaceSlugFromReferer({
        referer: `https://${host}/runmora/dashboard`,
        host: `${host}, internal-proxy:3000`,
      })
    ).toBe('runmora');
  });

  it('reads the subdomain in subdomain mode', () => {
    const reservedSubdomains = new Set(['www', 'app']);
    expect(
      workspaceSlugFromReferer({
        referer: 'https://runmora.example.com/dashboard',
        host: 'runmora.example.com',
        subdomainMode: true,
        reservedSubdomains,
      })
    ).toBe('runmora');
    expect(
      workspaceSlugFromReferer({
        referer: 'https://www.example.com/dashboard',
        host: 'www.example.com',
        subdomainMode: true,
        reservedSubdomains,
      })
    ).toBeNull();
    expect(
      workspaceSlugFromReferer({
        referer: 'https://runmora.example.com/dashboard',
        host: 'runmora.example.com',
      })
    ).toBeNull();
  });
});
