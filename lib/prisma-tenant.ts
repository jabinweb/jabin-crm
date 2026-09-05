/**
 * Per-company Prisma clients for BYO Postgres.
 *
 * - Control plane (Company, User, membership, billing metadata) → getControlPrisma()
 * - Data plane (leads, tickets, projects, …) → getDataPrisma(companyId)
 *
 * When databaseMode !== BYO_ACTIVE, getDataPrisma returns the shared Opslane client.
 * Never log connection URLs.
 */
import { prisma } from '@/lib/prisma';
import { getDecryptedCompanyDatabaseUrl } from '@/lib/tenancy/company-database';

type AppPrismaClient = typeof prisma;

const tenantClients = new Map<string, AppPrismaClient>();

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

function createTenantPrismaClient(connectionString: string): AppPrismaClient {
  const url = normalizePostgresConnectionString(connectionString);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client/index');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaPg } = require('@prisma/adapter-pg');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require('pg');

  const pool = new Pool({ connectionString: url, max: 5 });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter }) as AppPrismaClient;
}

/** Platform / Opslane control-plane client. */
export function getControlPrisma(): AppPrismaClient {
  return prisma;
}

/**
 * Evict a cached tenant client (e.g. after disconnect or URL change).
 * Does not close the pool eagerly — process recycle handles that.
 */
export function evictTenantPrisma(companyId: string): void {
  tenantClients.delete(companyId);
}

/**
 * Data-plane Prisma for a company.
 * BYO_ACTIVE → dedicated client from decrypted URL; otherwise shared Opslane prisma.
 */
export async function getDataPrisma(companyId: string): Promise<AppPrismaClient> {
  if (!companyId) return prisma;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { databaseMode: true },
  });

  if (!company || company.databaseMode !== 'BYO_ACTIVE') {
    return prisma;
  }

  const cached = tenantClients.get(companyId);
  if (cached) return cached;

  const url = await getDecryptedCompanyDatabaseUrl(companyId);
  if (!url) {
    throw new Error('BYO database is active but no URL is configured');
  }

  const client = createTenantPrismaClient(url);
  tenantClients.set(companyId, client);
  return client;
}
