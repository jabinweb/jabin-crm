import { prisma } from '@/lib/prisma';
import type { BusinessVertical } from '@/lib/workspace-templates';
import { getDefaultTicketTypesForVertical } from '@/lib/support/ticket-types';
import { upsertSlaPolicy } from '@/lib/crm/sla-policies';
import type { TicketPriority } from '@prisma/client';

const DEFAULT_SLA: Array<{
  priority: TicketPriority;
  name: string;
  responseHours: number;
  resolutionHours: number;
}> = [
  { priority: 'LOW', name: 'Standard — Low', responseHours: 8, resolutionHours: 72 },
  { priority: 'MEDIUM', name: 'Standard — Medium', responseHours: 4, resolutionHours: 48 },
  { priority: 'HIGH', name: 'Standard — High', responseHours: 2, resolutionHours: 24 },
  { priority: 'CRITICAL', name: 'Standard — Critical', responseHours: 1, resolutionHours: 8 },
];

/**
 * Seed default support groups from ticket type groupName values for a vertical.
 */
export async function seedDefaultSupportGroups(
  companyId: string,
  vertical: BusinessVertical = 'general'
) {
  const types = getDefaultTicketTypesForVertical(vertical);
  const groupNames = new Set<string>();

  for (const type of types) {
    if (type.groupName) groupNames.add(type.groupName);
  }

  if (groupNames.size === 0) {
    groupNames.add('General Support');
  }

  const existing = await prisma.supportGroup.findMany({
    where: { companyId },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((g) => g.name.toLowerCase()));

  let isFirst = existing.length === 0;
  for (const name of Array.from(groupNames)) {
    if (existingNames.has(name.toLowerCase())) continue;
    await prisma.supportGroup.create({
      data: {
        name,
        companyId,
        isDefault: isFirst,
        description: `Auto-created for ${vertical.replace(/_/g, ' ')} workspace`,
      },
    });
    isFirst = false;
  }
}

export async function seedDefaultSlaPolicies(companyId: string) {
  for (const policy of DEFAULT_SLA) {
    await upsertSlaPolicy({ ...policy, companyId });
  }
}

export async function seedCompanySupportDesk(
  companyId: string,
  vertical: BusinessVertical = 'general'
) {
  await Promise.all([
    seedDefaultSupportGroups(companyId, vertical),
    seedDefaultSlaPolicies(companyId),
  ]);
}
