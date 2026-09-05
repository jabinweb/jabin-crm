/**
 * Migrate company data-plane rows from Opslane (SHARED) to a connected BYO Postgres.
 *
 * Default forever: if the company never connects/migrates, all data stays on Opslane
 * (databaseMode SHARED, dataLocation opslane). Connecting a URL alone does not move data;
 * only a successful migrate cutover sets BYO_ACTIVE and purges shared copies.
 *
 * Control plane (User, Company, membership) always remains on Opslane.
 */
import { prisma } from '@/lib/prisma';
import { companyOwnedDocWhere } from '@/lib/crm/company-doc-scope';
import { purgeCompanyDataPlaneFromShared } from '@/lib/admin/delete-company';
import {
  getDecryptedCompanyDatabaseUrl,
  getCompanyDatabaseStatus,
  toPublicDatabaseStatus,
  type CompanyDatabasePublicStatus,
} from '@/lib/tenancy/company-database';
import { provisionCompanyDatabaseSchema } from '@/lib/tenancy/provision-company-database';
import { createTenantPrismaClientForUrl } from '@/lib/tenancy/create-tenant-client';
import { evictTenantPrisma } from '@/lib/prisma-tenant';

export type MigrateCompanyToByoResult = {
  status: CompanyDatabasePublicStatus;
  copied: Record<string, number>;
  skipped: string[];
};

type AnyClient = {
  [key: string]: {
    findMany?: (args?: unknown) => Promise<Record<string, unknown>[]>;
    createMany?: (args: {
      data: unknown[];
      skipDuplicates?: boolean;
    }) => Promise<{ count: number }>;
    create?: (args: { data: unknown }) => Promise<unknown>;
    upsert?: (args: unknown) => Promise<unknown>;
  };
};

async function copyMany(
  source: AnyClient,
  dest: AnyClient,
  model: string,
  where: Record<string, unknown>,
  opts?: { transform?: (row: Record<string, unknown>) => Record<string, unknown> }
): Promise<number> {
  const src = source[model];
  const dst = dest[model];
  if (!src?.findMany || !dst?.createMany) return 0;
  const rows = await src.findMany({ where });
  if (!rows.length) return 0;
  const data = opts?.transform ? rows.map(opts.transform) : rows;
  // Batch to avoid oversized payloads
  const chunkSize = 200;
  let total = 0;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const result = await dst.createMany({ data: chunk, skipDuplicates: true });
    total += result.count;
  }
  return total;
}

export async function migrateCompanyToByo(
  companyId: string
): Promise<MigrateCompanyToByoResult> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error('Company not found');

  const url = await getDecryptedCompanyDatabaseUrl(companyId);
  if (!url) {
    throw new Error('Connect a Postgres URL before migrating');
  }

  const mode = company.databaseMode || 'SHARED';
  if (mode === 'BYO_ACTIVE') {
    throw new Error('Company already uses BYO database');
  }
  if (mode === 'MIGRATING') {
    throw new Error('Migration already in progress');
  }
  if (mode !== 'SHARED' && mode !== 'FAILED') {
    throw new Error(`Cannot migrate from mode ${mode}`);
  }
  if (mode === 'FAILED' && !company.databaseUrlEncrypted) {
    throw new Error('No database URL configured');
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { databaseMode: 'MIGRATING', databaseLastError: null },
  });

  const copied: Record<string, number> = {};
  const skipped: string[] = [];
  let tenant: ReturnType<typeof createTenantPrismaClientForUrl> | null = null;

  try {
    const provision = await provisionCompanyDatabaseSchema(url);
    if (!provision.ok) {
      throw new Error(provision.error);
    }

    tenant = createTenantPrismaClientForUrl(url);
    const src = prisma as unknown as AnyClient;
    const dest = tenant as unknown as AnyClient;

    // 1) Company stub on tenant (FK parent for company-scoped rows)
    const companyRow = await prisma.company.findUnique({ where: { id: companyId } });
    if (companyRow) {
      await (tenant as AnyClient).company.createMany?.({
        data: [
          {
            ...companyRow,
            // Keep BYO markers consistent on tenant copy
            databaseMode: 'BYO_ACTIVE',
            databaseUrlEncrypted: null,
            databaseLastError: null,
          },
        ],
        skipDuplicates: true,
      });
      copied.company = 1;
    }

    // 2) Member users (+ lead owners) so optional user FKs resolve in tenant DB
    const memberships = await prisma.userCompany.findMany({
      where: { companyId },
      select: { userId: true },
    });
    const leadOwnerIds = (
      await prisma.lead.findMany({
        where: { companyId },
        select: { userId: true, assignedToId: true },
      })
    ).flatMap((l) => [l.userId, l.assignedToId].filter(Boolean) as string[]);
    const memberIds = Array.from(
      new Set([...memberships.map((m) => m.userId), ...leadOwnerIds])
    );
    if (memberIds.length > 0) {
      const users = await prisma.user.findMany({ where: { id: { in: memberIds } } });
      if (users.length) {
        await (tenant as AnyClient).user.createMany?.({
          data: users,
          skipDuplicates: true,
        });
        copied.user = users.length;
      }
    }

    // 3) HR org + employees
    copied.hrDepartment = await copyMany(src, dest, 'hrDepartment', { companyId });
    copied.hrDesignation = await copyMany(src, dest, 'hrDesignation', { companyId });
    copied.hrBranch = await copyMany(src, dest, 'hrBranch', { companyId });
    copied.employee = await copyMany(src, dest, 'employee', { companyId }, {
      transform: (row) => ({
        ...row,
        managerId: null,
        departmentId: row.departmentId,
        designationId: row.designationId,
        branchId: row.branchId,
      }),
    });

    // 4) Core CRM / ops models with companyId
    copied.client = await copyMany(src, dest, 'client', { companyId });
    copied.customer = await copyMany(src, dest, 'customer', { companyId });
    copied.lead = await copyMany(src, dest, 'lead', { companyId });
    copied.product = await copyMany(src, dest, 'product', { companyId });
    copied.location = await copyMany(src, dest, 'location', { companyId });
    copied.supplier = await copyMany(src, dest, 'supplier', { companyId });
    copied.asset = await copyMany(src, dest, 'asset', { companyId });
    copied.budget = await copyMany(src, dest, 'budget', { companyId });
    copied.expense = await copyMany(src, dest, 'expense', { companyId });

    // Deals for company leads
    const leadIds = (
      await prisma.lead.findMany({ where: { companyId }, select: { id: true } })
    ).map((l) => l.id);
    if (leadIds.length > 0) {
      copied.deal = await copyMany(src, dest, 'deal', { leadId: { in: leadIds } });
    } else {
      copied.deal = 0;
    }

    copied.project = await copyMany(src, dest, 'project', { companyId }, {
      transform: (row) => ({
        ...row,
        // deal may be missing if lead had no companyId historically
        dealId: row.dealId ?? null,
      }),
    });

    const projectIds = (
      await prisma.project.findMany({ where: { companyId }, select: { id: true } })
    ).map((p) => p.id);
    if (projectIds.length > 0) {
      copied.projectMilestone = await copyMany(src, dest, 'projectMilestone', {
        projectId: { in: projectIds },
      });
    }

    // Support tickets via customers (no companyId on SupportTicket)
    const customerIds = (
      await prisma.customer.findMany({ where: { companyId }, select: { id: true } })
    ).map((c) => c.id);
    if (customerIds.length > 0) {
      copied.supportTicket = await copyMany(
        src,
        dest,
        'supportTicket',
        { customerId: { in: customerIds } },
        {
          transform: (row) => ({
            ...row,
            // Optional FKs may point at rows not copied yet
            equipmentId: null,
            groupId: null,
            serviceContractId: null,
            assignedTechnicianId:
              typeof row.assignedTechnicianId === 'string' &&
              memberIds.includes(row.assignedTechnicianId)
                ? row.assignedTechnicianId
                : null,
            projectId:
              typeof row.projectId === 'string' && projectIds.includes(row.projectId)
                ? row.projectId
                : null,
            mergedIntoId: null,
          }),
        }
      );
      copied.serviceContract = await copyMany(src, dest, 'serviceContract', {
        companyId,
      });
    } else {
      copied.supportTicket = 0;
    }

    copied.supportGroup = await copyMany(src, dest, 'supportGroup', { companyId });
    copied.knowledgeArticle = await copyMany(src, dest, 'knowledgeArticle', {
      companyId,
    });
    copied.slaPolicy = await copyMany(src, dest, 'slaPolicy', { companyId });
    copied.visitTag = await copyMany(src, dest, 'visitTag', { companyId });
    copied.customerVisit = await copyMany(src, dest, 'customerVisit', { companyId });

    // Docs without companyId — scoped via lead / membership
    try {
      const quotations = await prisma.quotation.findMany({
        where: companyOwnedDocWhere(companyId),
      });
      if (quotations.length) {
        await (tenant as AnyClient).quotation.createMany?.({
          data: quotations,
          skipDuplicates: true,
        });
        copied.quotation = quotations.length;
      } else {
        copied.quotation = 0;
      }
    } catch {
      skipped.push(
        'Quotation: skipped (FK or schema mismatch; use companyOwnedDocWhere patterns later)'
      );
    }

    try {
      const invoices = await prisma.invoice.findMany({
        where: companyOwnedDocWhere(companyId),
      });
      if (invoices.length) {
        await (tenant as AnyClient).invoice.createMany?.({
          data: invoices,
          skipDuplicates: true,
        });
        copied.invoice = invoices.length;
      } else {
        copied.invoice = 0;
      }
    } catch {
      skipped.push(
        'Invoice: skipped (FK or schema mismatch; use companyOwnedDocWhere patterns later)'
      );
    }

    // Cutover: mark active, purge shared data-plane copies
    await prisma.company.update({
      where: { id: companyId },
      data: {
        databaseMode: 'BYO_ACTIVE',
        databaseLastError: null,
        databaseLastHealthAt: new Date(),
      },
    });

    await purgeCompanyDataPlaneFromShared(companyId);
    evictTenantPrisma(companyId);

    const status = await getCompanyDatabaseStatus(companyId);
    return { status, copied, skipped };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Migration failed';
    const scrubbed = message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgresql://***');
    await prisma.company.update({
      where: { id: companyId },
      data: {
        databaseMode: 'FAILED',
        databaseLastError: scrubbed.slice(0, 2000),
      },
    });
    evictTenantPrisma(companyId);
    throw new Error(scrubbed);
  } finally {
    // Best-effort disconnect of one-off tenant client
    try {
      await (tenant as { $disconnect?: () => Promise<void> } | null)?.$disconnect?.();
    } catch {
      /* ignore */
    }
  }
}

/** Provision schema only (no data copy). */
export async function provisionCompanyDatabase(companyId: string) {
  const url = await getDecryptedCompanyDatabaseUrl(companyId);
  if (!url) throw new Error('Connect a Postgres URL before provisioning');

  const result = await provisionCompanyDatabaseSchema(url);
  if (!result.ok) {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        databaseMode: 'FAILED',
        databaseLastError: result.error.slice(0, 2000),
      },
    });
    throw new Error(result.error);
  }

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
