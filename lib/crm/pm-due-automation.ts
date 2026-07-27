import { prisma } from '@/lib/prisma';
import { ticketService } from '@/lib/crm/ticket-service';
import { getIndustryVerticalPack } from '@/lib/industry-packs';
import { workspaceSettingsFromCompanySettings } from '@/lib/workspace-config';
import {
  resolveCompanyTicketConfig,
  resolveGroupIdForTicketType,
} from '@/lib/support/resolve-company-ticket-config';
import { findTicketTypeDefinition } from '@/lib/support/ticket-types';

export type PmDueAutomationResult = {
  companiesScanned: number;
  companiesEligible: number;
  created: number;
  skipped: number;
  errors: number;
};

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toYmd(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * For companies with an enabled `pm_due_create_ticket` pack automation,
 * create preventive_maintenance tickets when the latest service report's
 * nextMaintenanceDate is on or before today (per equipment).
 */
export async function runPmDueTicketAutomation(): Promise<PmDueAutomationResult> {
  const result: PmDueAutomationResult = {
    companiesScanned: 0,
    companiesEligible: 0,
    created: 0,
    skipped: 0,
    errors: 0,
  };

  const today = startOfUtcDay();
  const companies = await prisma.company.findMany({
    select: { id: true, settings: true },
    take: 500,
  });

  for (const company of companies) {
    result.companiesScanned += 1;
    const workspace = workspaceSettingsFromCompanySettings(company.settings);
    const pack = getIndustryVerticalPack(workspace.industryAlias);
    const automation = pack?.automations?.find(
      (a) => a.kind === 'pm_due_create_ticket' && a.enabled
    );
    if (!automation) continue;
    result.companiesEligible += 1;

    const ticketTypeId =
      (typeof automation.config?.ticketTypeId === 'string' &&
        automation.config.ticketTypeId) ||
      'preventive_maintenance';
    const leadDays =
      typeof automation.config?.leadDays === 'number'
        ? Math.max(0, automation.config.leadDays)
        : 0;
    const dueBefore = new Date(today);
    dueBefore.setUTCDate(dueBefore.getUTCDate() + leadDays);

    try {
      const reports = await prisma.serviceReport.findMany({
        where: {
          nextMaintenanceDate: { not: null, lte: dueBefore },
          ticket: { customer: { companyId: company.id } },
        },
        select: {
          id: true,
          nextMaintenanceDate: true,
          ticket: {
            select: {
              customerId: true,
              equipmentId: true,
              serviceContractId: true,
              customer: { select: { organizationName: true } },
              equipment: {
                select: {
                  id: true,
                  serialNumber: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { nextMaintenanceDate: 'asc' },
        take: 200,
      });

      // Latest due date per equipment (or customer if no equipment)
      const byKey = new Map<string, (typeof reports)[number]>();
      for (const report of reports) {
        if (!report.nextMaintenanceDate) continue;
        const key = report.ticket.equipmentId
          ? `eq:${report.ticket.equipmentId}`
          : `cu:${report.ticket.customerId}`;
        const existing = byKey.get(key);
        if (
          !existing ||
          (existing.nextMaintenanceDate &&
            report.nextMaintenanceDate > existing.nextMaintenanceDate)
        ) {
          byKey.set(key, report);
        }
      }

      const { ticketTypes } = await resolveCompanyTicketConfig(company.id);
      const typeDef = findTicketTypeDefinition(ticketTypes, ticketTypeId);
      const groupId = typeDef
        ? await resolveGroupIdForTicketType(company.id, typeDef)
        : undefined;

      for (const report of Array.from(byKey.values())) {
        const equipmentId = report.ticket.equipmentId ?? undefined;
        const customerId = report.ticket.customerId;
        const due = report.nextMaintenanceDate!;
        const dueYmd = toYmd(due);

        const openExisting = await prisma.supportTicket.findFirst({
          where: {
            customerId,
            ...(equipmentId ? { equipmentId } : {}),
            ticketType: ticketTypeId,
            status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
            OR: [
              { tags: { has: 'automation:pm_due' } },
              { tags: { has: `pm-due:${dueYmd}` } },
            ],
          },
          select: { id: true },
        });
        if (openExisting) {
          result.skipped += 1;
          continue;
        }

        const deviceName =
          report.ticket.equipment?.product?.name ||
          report.ticket.equipment?.serialNumber ||
          'Equipment';
        const org = report.ticket.customer.organizationName;

        try {
          await ticketService.createTicket({
            customerId,
            equipmentId,
            serviceContractId: report.ticket.serviceContractId,
            companyId: company.id,
            groupId: groupId ?? undefined,
            subject: `Preventive maintenance due — ${deviceName}`,
            description: `Automated PM ticket: next maintenance was due on ${dueYmd} for ${deviceName} at ${org}.`,
            priority: typeDef?.defaultPriority ?? 'MEDIUM',
            channel: 'API',
            ticketType: ticketTypeId,
            tags: ['automation:pm_due', `pm-due:${dueYmd}`],
            customFields: { pmDueDate: dueYmd },
          });
          result.created += 1;
        } catch (err) {
          console.error('[pm-due] create ticket failed', err);
          result.errors += 1;
        }
      }
    } catch (err) {
      console.error(`[pm-due] company ${company.id}`, err);
      result.errors += 1;
    }
  }

  return result;
}
