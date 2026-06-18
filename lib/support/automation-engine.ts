import { prisma } from '@/lib/prisma';
import {
  parseAutomationRules,
  ruleMatches,
  DEFAULT_AUTOMATION_RULES,
  type AutomationTrigger,
} from '@/lib/support/automation-rules';
import type { TicketPriority, TicketStatus } from '@prisma/client';

export interface AutomationEventContext {
  ticketId: string;
  companyId: string;
  trigger: AutomationTrigger;
  channel?: string;
  ticketType?: string | null;
  priority?: TicketPriority;
  status?: TicketStatus;
  subject?: string;
}

async function getRulesForCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  const stored =
    company?.settings && typeof company.settings === 'object' && !Array.isArray(company.settings)
      ? (company.settings as Record<string, unknown>)
      : {};
  const support = stored.support as Record<string, unknown> | undefined;
  const custom = parseAutomationRules(support?.automation);
  return custom.length > 0 ? custom : DEFAULT_AUTOMATION_RULES;
}

export async function runSupportAutomations(ctx: AutomationEventContext) {
  const rules = await getRulesForCompany(ctx.companyId);
  const matching = rules.filter((rule) =>
    ruleMatches(rule, {
      trigger: ctx.trigger,
      channel: ctx.channel,
      ticketType: ctx.ticketType,
      priority: ctx.priority,
      status: ctx.status,
    })
  );

  if (matching.length === 0) return;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ctx.ticketId },
    select: { id: true, tags: true, priority: true, groupId: true, customerId: true },
  });
  if (!ticket) return;

  const tagSet = new Set(ticket.tags);
  let priority = ticket.priority;
  let groupId = ticket.groupId;

  for (const rule of matching) {
    for (const action of rule.actions) {
      switch (action.type) {
        case 'ADD_TAG':
          tagSet.add(action.tag);
          break;
        case 'SET_PRIORITY':
          priority = action.priority;
          break;
        case 'ASSIGN_GROUP': {
          const group = await prisma.supportGroup.findFirst({
            where: {
              companyId: ctx.companyId,
              name: { equals: action.groupName, mode: 'insensitive' },
            },
            select: { id: true },
          });
          if (group) groupId = group.id;
          break;
        }
        case 'NOTIFY': {
          const admins = await prisma.user.findMany({
            where: {
              OR: [
                { companyId: ctx.companyId },
                { primaryCompanyId: ctx.companyId },
                { userCompanies: { some: { companyId: ctx.companyId } } },
              ],
              role: { in: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'] },
            },
            select: { id: true },
            take: 10,
          });
          for (const admin of admins) {
            await prisma.notification.create({
              data: {
                userId: admin.id,
                type: 'TICKET_UPDATED',
                title: action.title,
                body: action.body,
                metadata: { ticketId: ctx.ticketId, ruleId: rule.id, automation: true },
              },
            }).catch(() => undefined);
          }
          break;
        }
      }
    }

    await prisma.ticketActivity.create({
      data: {
        ticketId: ctx.ticketId,
        eventType: 'AUTOMATION',
        description: `Automation "${rule.name}" applied`,
        metadata: { ruleId: rule.id, trigger: ctx.trigger },
      },
    });
  }

  await prisma.supportTicket.update({
    where: { id: ctx.ticketId },
    data: {
      tags: Array.from(tagSet),
      priority,
      groupId,
    },
  });
}
