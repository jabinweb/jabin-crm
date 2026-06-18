import { prisma } from '@/lib/prisma';
import {
  parseWorkspaceSettings,
  resolveWorkspaceConfig,
} from '@/lib/workspace-config';
import {
  parseSupportSettings,
  resolvePortalTicketTypes,
  type PortalTicketTypeDefinition,
} from '@/lib/support/ticket-types';

export async function resolveCompanyTicketConfig(companyId: string | null | undefined) {
  if (!companyId) {
    const config = resolveWorkspaceConfig({ businessVertical: 'general' });
    return {
      companyId: null,
      config,
      ticketTypes: resolvePortalTicketTypes(config),
    };
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });

  const stored =
    company?.settings && typeof company.settings === 'object' && !Array.isArray(company.settings)
      ? (company.settings as Record<string, unknown>)
      : {};

  const workspaceSettings = parseWorkspaceSettings(stored.workspace);
  const supportSettings = parseSupportSettings(stored.support);
  const config = resolveWorkspaceConfig(workspaceSettings);
  const ticketTypes = resolvePortalTicketTypes(config, supportSettings);

  return { companyId, config, ticketTypes, supportSettings };
}

export async function resolveGroupIdForTicketType(
  companyId: string | null | undefined,
  type: PortalTicketTypeDefinition
): Promise<string | undefined> {
  if (!companyId || !type.groupName) return undefined;

  const group = await prisma.supportGroup.findFirst({
    where: {
      companyId,
      name: { equals: type.groupName, mode: 'insensitive' },
    },
    select: { id: true },
  });

  return group?.id;
}
