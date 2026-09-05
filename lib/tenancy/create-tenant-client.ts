/**
 * One-off Prisma client for a tenant URL (migrate / provision helpers).
 * Prefer getDataPrisma for request-path usage.
 */
type AppPrismaClient = any;

function normalizePostgresConnectionString(raw: string): string {
  if (!raw || raw.startsWith('prisma://')) return raw;
  try {
    const u = new URL(raw);
    const mode = (u.searchParams.get('sslmode') || '').toLowerCase();
    if (!mode) return raw;
    if (u.searchParams.get('uselibpqcompat') === 'true') return raw;
    if (mode === 'require' || mode === 'prefer' || mode === 'verify-ca') {
      u.searchParams.set('sslmode', 'verify-full');
      return u.toString();
    }
    return raw;
  } catch {
    return raw;
  }
}

export function createTenantPrismaClientForUrl(connectionString: string): AppPrismaClient {
  const url = normalizePostgresConnectionString(connectionString);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client/index');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaPg } = require('@prisma/adapter-pg');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require('pg');

  const pool = new Pool({ connectionString: url, max: 3 });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}
