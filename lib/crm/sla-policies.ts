import { TicketPriority } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getIndustryVerticalPack } from '@/lib/industry-packs';
import { workspaceSettingsFromCompanySettings } from '@/lib/workspace-config';

export type SlaConfig = {
  responseHours: number;
  resolutionHours: number;
  policyName?: string;
};

const FALLBACK_BY_PRIORITY: Record<TicketPriority, SlaConfig> = {
  LOW: { responseHours: 8, resolutionHours: 72, policyName: 'Default — Low' },
  MEDIUM: { responseHours: 4, resolutionHours: 48, policyName: 'Default — Medium' },
  HIGH: { responseHours: 2, resolutionHours: 24, policyName: 'Default — High' },
  CRITICAL: { responseHours: 1, resolutionHours: 8, policyName: 'Default — Critical' },
};

async function getIndustryPackSla(
  companyId: string | null | undefined,
  priority: TicketPriority
): Promise<SlaConfig | null> {
  if (!companyId) return null;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  const workspace = workspaceSettingsFromCompanySettings(company?.settings);
  const pack = getIndustryVerticalPack(workspace.industryAlias);
  const row = pack?.slaByPriority?.[priority];
  if (!row) return null;
  return {
    responseHours: row.responseHours,
    resolutionHours: row.resolutionHours,
    policyName: `${pack!.label} — ${priority}`,
  };
}

export async function getSlaConfigForPriority(
  priority: TicketPriority,
  companyId?: string | null
): Promise<SlaConfig> {
  if (companyId) {
    const companyPolicy = await prisma.slaPolicy.findUnique({
      where: { companyId_priority: { companyId, priority } },
    });
    if (companyPolicy) {
      return {
        responseHours: companyPolicy.responseHours,
        resolutionHours: companyPolicy.resolutionHours,
        policyName: companyPolicy.name,
      };
    }
  }

  const packSla = await getIndustryPackSla(companyId, priority);
  if (packSla) return packSla;

  const globalPolicy = await prisma.slaPolicy.findFirst({
    where: { companyId: null, priority },
  });

  if (globalPolicy) {
    return {
      responseHours: globalPolicy.responseHours,
      resolutionHours: globalPolicy.resolutionHours,
      policyName: globalPolicy.name,
    };
  }

  return FALLBACK_BY_PRIORITY[priority] ?? FALLBACK_BY_PRIORITY.MEDIUM;
}

export async function listSlaPolicies(companyId?: string | null) {
  return prisma.slaPolicy.findMany({
    where: companyId ? { OR: [{ companyId }, { companyId: null }] } : { companyId: null },
    orderBy: [{ companyId: 'desc' }, { priority: 'asc' }],
  });
}

export async function getSlaConfigForTicket(options: {
  priority: TicketPriority;
  ticketType?: string | null;
  companyId?: string | null;
  supportSettings?: import('@/lib/support/ticket-types').SupportSettings;
}): Promise<SlaConfig> {
  const { priority, ticketType, companyId, supportSettings } = options;

  if (ticketType && supportSettings?.slaByTicketType?.[ticketType]) {
    const override = supportSettings.slaByTicketType[ticketType];
    return {
      responseHours: override.responseHours,
      resolutionHours: override.resolutionHours,
      policyName: override.name ?? `SLA — ${ticketType}`,
    };
  }

  return getSlaConfigForPriority(priority, companyId);
}

export async function upsertSlaPolicy(data: {
  companyId?: string | null;
  priority: TicketPriority;
  name: string;
  responseHours: number;
  resolutionHours: number;
}) {
  const companyId = data.companyId ?? null;
  if (companyId) {
    return prisma.slaPolicy.upsert({
      where: { companyId_priority: { companyId, priority: data.priority } },
      create: {
        name: data.name,
        priority: data.priority,
        responseHours: data.responseHours,
        resolutionHours: data.resolutionHours,
        companyId,
      },
      update: {
        name: data.name,
        responseHours: data.responseHours,
        resolutionHours: data.resolutionHours,
      },
    });
  }

  const existing = await prisma.slaPolicy.findFirst({
    where: { companyId: null, priority: data.priority },
  });

  if (existing) {
    return prisma.slaPolicy.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        responseHours: data.responseHours,
        resolutionHours: data.resolutionHours,
      },
    });
  }

  return prisma.slaPolicy.create({
    data: {
      name: data.name,
      priority: data.priority,
      responseHours: data.responseHours,
      resolutionHours: data.resolutionHours,
      companyId: null,
    },
  });
}
