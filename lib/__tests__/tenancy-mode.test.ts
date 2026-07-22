import {
  formatWorkspaceAddress,
  getEnvTenancyMode,
  parseTenancyMode,
  tenantAppPath,
} from '@/lib/tenancy/mode';

describe('tenancy mode', () => {
  it('defaults to path', () => {
    expect(getEnvTenancyMode({})).toBe('path');
    expect(parseTenancyMode('nope')).toBeNull();
  });

  it('formats path and subdomain addresses', () => {
    expect(formatWorkspaceAddress('acme', 'path', 'https://opslane.app')).toBe(
      'opslane.app/acme'
    );
    expect(formatWorkspaceAddress('acme', 'subdomain', 'https://opslane.app')).toBe(
      'acme.opslane.app'
    );
  });

  it('keeps in-app paths slug-prefixed', () => {
    expect(tenantAppPath('acme')).toBe('/acme/dashboard');
    expect(tenantAppPath('acme', '/dashboard/leads')).toBe('/acme/dashboard/leads');
  });
});
