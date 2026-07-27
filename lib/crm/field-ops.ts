import { prisma } from '@/lib/prisma';
import {
  VISIT_COUNTING_STATUSES,
  computeVisitUsage,
  type VisitUsage,
} from '@/lib/crm/service-contract-utils';
import {
  parseFieldOpsSettings,
  type FieldOpsSettings,
} from '@/lib/crm/field-ops-settings';

export {
  parseFieldOpsSettings,
  evaluateGeoFence,
  distanceMeters,
  DEFAULT_FIELD_OPS_SETTINGS,
  type FieldOpsSettings,
} from '@/lib/crm/field-ops-settings';

export async function countContractVisitsUsed(serviceContractId: string): Promise<number> {
  return prisma.supportTicket.count({
    where: {
      serviceContractId,
      status: { in: [...VISIT_COUNTING_STATUSES] },
    },
  });
}

export async function getContractVisitUsage(
  serviceContractId: string,
  visitLimit: number | null | undefined
): Promise<VisitUsage> {
  const visitsUsed = await countContractVisitsUsed(serviceContractId);
  return computeVisitUsage(visitLimit, visitsUsed);
}

export async function attachVisitUsage<T extends { id: string; visitLimit: number | null }>(
  contracts: T[]
): Promise<Array<T & VisitUsage>> {
  if (contracts.length === 0) return [] as Array<T & VisitUsage>;

  const ids = contracts.map((c) => c.id);
  const grouped = await prisma.supportTicket.groupBy({
    by: ['serviceContractId'],
    where: {
      serviceContractId: { in: ids },
      status: { in: [...VISIT_COUNTING_STATUSES] },
    },
    _count: { _all: true },
  });

  const usedMap = new Map<string, number>();
  for (const g of grouped) {
    if (g.serviceContractId) {
      usedMap.set(g.serviceContractId, g._count._all);
    }
  }

  return contracts.map((c) => {
    const usage = computeVisitUsage(c.visitLimit, usedMap.get(c.id) ?? 0);
    return { ...c, ...usage };
  });
}

export async function getFieldOpsSettings(companyId: string): Promise<FieldOpsSettings> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  const stored =
    company?.settings && typeof company.settings === 'object' && !Array.isArray(company.settings)
      ? (company.settings as Record<string, unknown>)
      : {};
  return parseFieldOpsSettings(stored.fieldOps);
}
