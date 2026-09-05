import { Pool } from 'pg';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

export const DATABASE_MODES = [
  'SHARED',
  'CONNECTING',
  'MIGRATING',
  'BYO_ACTIVE',
  'FAILED',
] as const;

export type DatabaseMode = (typeof DATABASE_MODES)[number];

export type CompanyDatabasePublicStatus = {
  databaseMode: DatabaseMode;
  hasDatabaseUrl: boolean;
  databaseHostMasked: string | null;
  databaseConnectedAt: string | null;
  databaseLastHealthAt: string | null;
  databaseLastError: string | null;
  /** Default: data lives on Opslane until BYO_ACTIVE */
  dataLocation: 'opslane' | 'company';
};

function packEncrypted(url: string): string {
  return JSON.stringify(encrypt(url));
}

function unpackEncrypted(blob: string | null | undefined): string | null {
  if (!blob) return null;
  const plain = decrypt(blob);
  return plain || null;
}

export function maskDatabaseHost(url: string): string {
  try {
    const u = new URL(url);
    const db = u.pathname?.replace(/^\//, '') || '';
    return `${u.hostname}${db ? `/${db}` : ''}`;
  } catch {
    return '***';
  }
}

export function validatePostgresUrl(url: string): { ok: true } | { ok: false; error: string } {
  const trimmed = url.trim();
  if (!trimmed) return { ok: false, error: 'Database URL is required' };
  if (!/^postgres(ql)?:\/\//i.test(trimmed)) {
    return { ok: false, error: 'URL must start with postgresql:// or postgres://' };
  }
  try {
    const u = new URL(trimmed);
    if (process.env.NODE_ENV === 'production') {
      const host = u.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        return { ok: false, error: 'Localhost URLs are not allowed in production' };
      }
    }
  } catch {
    return { ok: false, error: 'Invalid database URL' };
  }
  return { ok: true };
}

export async function testPostgresConnection(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 8000 });
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return { ok: true };
    } finally {
      client.release();
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Connection failed';
    return { ok: false, error: message };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export function toPublicDatabaseStatus(company: {
  databaseMode?: string | null;
  databaseUrlEncrypted?: string | null;
  databaseHostMasked?: string | null;
  databaseConnectedAt?: Date | null;
  databaseLastHealthAt?: Date | null;
  databaseLastError?: string | null;
}): CompanyDatabasePublicStatus {
  const mode = (company.databaseMode || 'SHARED') as DatabaseMode;
  const hasDatabaseUrl = Boolean(company.databaseUrlEncrypted);
  return {
    databaseMode: mode,
    hasDatabaseUrl,
    databaseHostMasked: company.databaseHostMasked ?? null,
    databaseConnectedAt: company.databaseConnectedAt?.toISOString() ?? null,
    databaseLastHealthAt: company.databaseLastHealthAt?.toISOString() ?? null,
    databaseLastError: company.databaseLastError ?? null,
    dataLocation: mode === 'BYO_ACTIVE' ? 'company' : 'opslane',
  };
}

export async function getCompanyDatabaseStatus(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      databaseMode: true,
      databaseUrlEncrypted: true,
      databaseHostMasked: true,
      databaseConnectedAt: true,
      databaseLastHealthAt: true,
      databaseLastError: true,
    },
  });
  if (!company) throw new Error('Company not found');
  return toPublicDatabaseStatus(company);
}

export async function getDecryptedCompanyDatabaseUrl(
  companyId: string
): Promise<string | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { databaseUrlEncrypted: true },
  });
  return unpackEncrypted(company?.databaseUrlEncrypted);
}

/** Save URL (encrypted), test connection. Default remains SHARED until migrate cutover. */
export async function connectCompanyDatabase(companyId: string, url: string) {
  const valid = validatePostgresUrl(url);
  if (!valid.ok) throw new Error(valid.error);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, databaseMode: true },
  });
  if (!company) throw new Error('Company not found');
  if (company.databaseMode === 'BYO_ACTIVE' || company.databaseMode === 'MIGRATING') {
    throw new Error('Disconnect or finish migration before changing the database URL');
  }

  await prisma.company.update({
    where: { id: companyId },
    data: {
      databaseMode: 'CONNECTING',
      databaseLastError: null,
    },
  });

  const test = await testPostgresConnection(url);
  if (!test.ok) {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        databaseMode: 'FAILED',
        databaseLastError: test.error,
      },
    });
    throw new Error(test.error);
  }

  const now = new Date();
  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      databaseUrlEncrypted: packEncrypted(url),
      databaseHostMasked: maskDatabaseHost(url),
      databaseConnectedAt: now,
      databaseLastHealthAt: now,
      databaseLastError: null,
      // Still SHARED for data location until migrate — URL is ready
      databaseMode: 'SHARED',
    },
    select: {
      databaseMode: true,
      databaseUrlEncrypted: true,
      databaseHostMasked: true,
      databaseConnectedAt: true,
      databaseLastHealthAt: true,
      databaseLastError: true,
    },
  });

  return toPublicDatabaseStatus(updated);
}

export async function healthCheckCompanyDatabase(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      databaseMode: true,
      databaseUrlEncrypted: true,
      databaseHostMasked: true,
      databaseConnectedAt: true,
      databaseLastHealthAt: true,
      databaseLastError: true,
    },
  });
  if (!company) throw new Error('Company not found');
  const url = unpackEncrypted(company.databaseUrlEncrypted);
  if (!url) throw new Error('No database URL configured');

  const prevMode = (company.databaseMode || 'SHARED') as DatabaseMode;
  const test = await testPostgresConnection(url);

  if (!test.ok) {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        databaseLastError: test.error,
        databaseMode: 'FAILED',
      },
    });
    throw new Error(test.error);
  }

  const nextMode: DatabaseMode =
    prevMode === 'BYO_ACTIVE' || prevMode === 'MIGRATING' ? prevMode : 'SHARED';

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      databaseLastHealthAt: new Date(),
      databaseLastError: null,
      databaseMode: nextMode === 'MIGRATING' ? 'MIGRATING' : nextMode,
    },
    select: {
      databaseMode: true,
      databaseUrlEncrypted: true,
      databaseHostMasked: true,
      databaseConnectedAt: true,
      databaseLastHealthAt: true,
      databaseLastError: true,
    },
  });

  return toPublicDatabaseStatus(updated);
}

export async function disconnectCompanyDatabase(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { databaseMode: true },
  });
  if (!company) throw new Error('Company not found');
  if (company.databaseMode === 'BYO_ACTIVE') {
    throw new Error(
      'Cannot disconnect while BYO is active. Migrate data back to Opslane first (not yet supported) or contact support.'
    );
  }
  if (company.databaseMode === 'MIGRATING') {
    throw new Error('Migration in progress');
  }

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      databaseUrlEncrypted: null,
      databaseHostMasked: null,
      databaseConnectedAt: null,
      databaseLastHealthAt: null,
      databaseLastError: null,
      databaseMode: 'SHARED',
    },
    select: {
      databaseMode: true,
      databaseUrlEncrypted: true,
      databaseHostMasked: true,
      databaseConnectedAt: true,
      databaseLastHealthAt: true,
      databaseLastError: true,
    },
  });

  return toPublicDatabaseStatus(updated);
}
