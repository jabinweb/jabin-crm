import {
  connectCompanyDatabase,
  disconnectCompanyDatabase,
  getCompanyDatabaseStatus,
  healthCheckCompanyDatabase,
} from '@/lib/tenancy/company-database';
import {
  migrateCompanyToByo,
  provisionCompanyDatabase,
} from '@/lib/tenancy/migrate-company-to-byo';
import { evictTenantPrisma } from '@/lib/prisma-tenant';

export const DATABASE_ACTIONS = [
  'connect',
  'health',
  'disconnect',
  'migrate',
  'provision',
] as const;

export type DatabaseAction = (typeof DATABASE_ACTIONS)[number];

export type DatabaseActionBody = {
  action: DatabaseAction;
  url?: string;
};

export async function runCompanyDatabaseAction(
  companyId: string,
  body: DatabaseActionBody
) {
  const action = body.action;
  if (!DATABASE_ACTIONS.includes(action)) {
    throw new Error(`Unknown action: ${String(action)}`);
  }

  switch (action) {
    case 'connect': {
      if (!body.url || typeof body.url !== 'string') {
        throw new Error('url is required for connect');
      }
      return { status: await connectCompanyDatabase(companyId, body.url) };
    }
    case 'health':
      return { status: await healthCheckCompanyDatabase(companyId) };
    case 'disconnect': {
      const status = await disconnectCompanyDatabase(companyId);
      evictTenantPrisma(companyId);
      return { status };
    }
    case 'provision':
      return { status: await provisionCompanyDatabase(companyId) };
    case 'migrate': {
      const result = await migrateCompanyToByo(companyId);
      return {
        status: result.status,
        copied: result.copied,
        skipped: result.skipped,
      };
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
