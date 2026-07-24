import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { AgentRuntimeContext } from '@/lib/agent/context';
import { invoiceService } from '@/lib/crm/invoice-service';
import { qualifyLead, suggestTasks } from '@/lib/ai/ai-service';
import { EXTENDED_OPS_TOOLS } from '@/lib/agent/ops-tools-extended';
import type { AgentToolDef, ToolKind } from '@/lib/agent/tool-types';

export type { AgentToolDef, ToolKind } from '@/lib/agent/tool-types';

function companyInvoiceWhere(companyId: string) {
  return {
    OR: [
      { customer: { companyId } },
      { user: { primaryCompanyId: companyId } },
      { user: { userCompanies: { some: { companyId } } } },
    ],
  };
}

function companyLeadWhere(companyId: string) {
  return {
    OR: [
      { companyId },
      { user: { primaryCompanyId: companyId } },
      { user: { userCompanies: { some: { companyId } } } },
    ],
  };
}

export const AGENT_TOOLS_BASE: AgentToolDef[] = [
  // ── Core reads & writes (base) ─────────────────────────────────────────
  {
    name: 'get_company_snapshot',
    description: 'Get live counts for open tickets, overdue invoices, open deals, pending quotes, and due tasks.',
    kind: 'read',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: async (_args, ctx) => ctx.snapshot,
  },
  {
    name: 'list_overdue_invoices',
    description: 'List overdue invoices for this company (id, number, customer, amount due, due date).',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max rows (default 10)' },
      },
    },
    execute: async (args, ctx) => {
      const limit = Math.min(Number(args.limit) || 10, 25);
      const rows = await prisma.invoice.findMany({
        where: { ...companyInvoiceWhere(ctx.companyId), status: 'OVERDUE' },
        select: {
          id: true,
          invoiceNumber: true,
          customerName: true,
          amountDue: true,
          total: true,
          currency: true,
          dueDate: true,
          status: true,
        },
        orderBy: { dueDate: 'asc' },
        take: limit,
      });
      return { invoices: rows };
    },
  },
  {
    name: 'list_open_tickets',
    description: 'List open support tickets for this company.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
      },
    },
    execute: async (args, ctx) => {
      const limit = Math.min(Number(args.limit) || 10, 25);
      const rows = await prisma.supportTicket.findMany({
        where: {
          customer: { companyId: ctx.companyId },
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
        },
        select: {
          id: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
          customer: { select: { organizationName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return { tickets: rows };
    },
  },
  {
    name: 'list_open_deals',
    description: 'List open deals (not closed won/lost) for this company.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
    execute: async (args, ctx) => {
      const limit = Math.min(Number(args.limit) || 10, 25);
      const rows = await prisma.deal.findMany({
        where: {
          OR: [
            { lead: { companyId: ctx.companyId } },
            { user: { primaryCompanyId: ctx.companyId } },
          ],
          stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
        },
        select: {
          id: true,
          title: true,
          value: true,
          currency: true,
          stage: true,
          expectedCloseDate: true,
          lead: { select: { companyName: true, email: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      });
      return { deals: rows };
    },
  },
  {
    name: 'list_pending_quotations',
    description: 'List quotations awaiting customer response (SENT or VIEWED).',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
    execute: async (args, ctx) => {
      const limit = Math.min(Number(args.limit) || 10, 25);
      const rows = await prisma.quotation.findMany({
        where: {
          OR: [
            { customer: { companyId: ctx.companyId } },
            { user: { primaryCompanyId: ctx.companyId } },
          ],
          status: { in: ['SENT', 'VIEWED'] },
        },
        select: {
          id: true,
          quotationNumber: true,
          title: true,
          customerName: true,
          total: true,
          currency: true,
          status: true,
          validUntil: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return { quotations: rows };
    },
  },
  {
    name: 'search_customers',
    description: 'Search customers by name, email, or phone.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
    execute: async (args, ctx) => {
      const q = String(args.query || '').trim();
      if (!q) return { customers: [] };
      const limit = Math.min(Number(args.limit) || 10, 25);
      const rows = await prisma.customer.findMany({
        where: {
          companyId: ctx.companyId,
          OR: [
            { organizationName: { contains: q, mode: 'insensitive' } },
            { contactPerson: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          organizationName: true,
          contactPerson: true,
          email: true,
          phone: true,
          billingCurrency: true,
          city: true,
        },
        take: limit,
      });
      return { customers: rows };
    },
  },
  {
    name: 'search_leads',
    description: 'Search leads by company name, email, or contact.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
    execute: async (args, ctx) => {
      const q = String(args.query || '').trim();
      if (!q) return { leads: [] };
      const limit = Math.min(Number(args.limit) || 10, 25);
      const rows = await prisma.lead.findMany({
        where: {
          AND: [
            companyLeadWhere(ctx.companyId),
            {
              OR: [
                { companyName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { contactName: { contains: q, mode: 'insensitive' } },
              ],
            },
          ],
        },
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
          status: true,
          phone: true,
        },
        take: limit,
      });
      return { leads: rows };
    },
  },
  {
    name: 'get_invoice',
    description: 'Get invoice details by id or invoice number.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string' },
        invoiceNumber: { type: 'string' },
      },
    },
    execute: async (args, ctx) => {
      const invoiceId = args.invoiceId ? String(args.invoiceId) : '';
      const invoiceNumber = args.invoiceNumber ? String(args.invoiceNumber) : '';
      if (!invoiceId && !invoiceNumber) return { error: 'invoiceId or invoiceNumber required' };
      const invoice = await prisma.invoice.findFirst({
        where: {
          ...companyInvoiceWhere(ctx.companyId),
          ...(invoiceId ? { id: invoiceId } : { invoiceNumber }),
        },
        include: { items: true },
      });
      if (!invoice) return { error: 'Invoice not found' };
      return { invoice };
    },
  },
  {
    name: 'create_task',
    description: 'Create a CRM task. Requires user confirmation before execute.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        dueDate: { type: 'string', description: 'ISO date' },
        leadId: { type: 'string' },
        dealId: { type: 'string' },
        priority: { type: 'string', description: 'LOW|MEDIUM|HIGH|URGENT' },
      },
      required: ['title'],
    },
    execute: async (args, ctx) => {
      const title = String(args.title || '').trim();
      if (!title) throw new Error('title required');
      const priority = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(
        String(args.priority || '')
      )
        ? (String(args.priority) as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')
        : 'MEDIUM';
      const task = await prisma.task.create({
        data: {
          userId: ctx.userId,
          assignedToId: ctx.userId,
          title,
          description: args.description ? String(args.description) : null,
          dueDate: args.dueDate ? new Date(String(args.dueDate)) : null,
          leadId: args.leadId ? String(args.leadId) : null,
          dealId: args.dealId ? String(args.dealId) : null,
          priority,
          status: 'PENDING',
          type: 'TODO',
        },
      });
      return { task };
    },
  },
  {
    name: 'add_lead_note',
    description: 'Add an activity note on a lead. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['leadId', 'note'],
    },
    execute: async (args, ctx) => {
      const leadId = String(args.leadId);
      const note = String(args.note || '').trim();
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, ...companyLeadWhere(ctx.companyId) },
        select: { id: true },
      });
      if (!lead) throw new Error('Lead not found');
      const activity = await prisma.leadActivity.create({
        data: {
          leadId,
          userId: ctx.userId,
          activityType: 'NOTE_ADDED',
          description: note,
        },
      });
      return { activity };
    },
  },
  {
    name: 'record_invoice_payment',
    description:
      'Record a payment against an invoice (updates amount paid/due). Requires confirmation. ADMIN preferred.',
    kind: 'write',
    roles: ['ADMIN', 'SUPER_ADMIN', 'SALES', 'MANAGER'],
    parameters: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string' },
        amount: { type: 'number' },
        paymentMethod: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['invoiceId', 'amount'],
    },
    execute: async (args, ctx) => {
      const invoiceId = String(args.invoiceId);
      const owned = await prisma.invoice.findFirst({
        where: { id: invoiceId, ...companyInvoiceWhere(ctx.companyId) },
        select: { id: true },
      });
      if (!owned) throw new Error('Invoice not found');
      const amount = Number(args.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid amount');
      const invoice = await invoiceService.recordPayment(invoiceId, {
        amount,
        paymentMethod: args.paymentMethod ? String(args.paymentMethod) : 'OTHER',
        paymentDetails: args.note ? String(args.note) : undefined,
      });
      return {
        id: invoice.id,
        status: invoice.status,
        amountPaid: invoice.amountPaid,
        amountDue: invoice.amountDue,
      };
    },
  },
  {
    name: 'qualify_lead_ai',
    description: 'AI-qualify a lead and return score/insights (uses Gemini).',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { leadId: { type: 'string' } },
      required: ['leadId'],
    },
    execute: async (args, ctx, apiKey) => {
      const lead = await prisma.lead.findFirst({
        where: { id: String(args.leadId), ...companyLeadWhere(ctx.companyId) },
      });
      if (!lead) throw new Error('Lead not found');
      return qualifyLead({
        apiKey,
        companyName: lead.companyName,
        industry: lead.industry || undefined,
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        source: lead.source || undefined,
      });
    },
  },
  {
    name: 'suggest_tasks_ai',
    description: 'AI-suggest follow-up tasks for a lead.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { leadId: { type: 'string' } },
      required: ['leadId'],
    },
    execute: async (args, ctx, apiKey) => {
      const leadId = String(args.leadId);
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, ...companyLeadWhere(ctx.companyId) },
        include: {
          emailLogs: { take: 20, orderBy: { createdAt: 'desc' } },
          deals: { take: 5 },
        },
      });
      if (!lead) throw new Error('Lead not found');
      const opens = lead.emailLogs.filter((e) => e.openedAt).length;
      const clicks = lead.emailLogs.filter((e) => e.clickedAt).length;
      const replies = lead.emailLogs.filter((e) => e.repliedAt).length;
      return suggestTasks({
        apiKey,
        context: {
          leadId: lead.id,
          leadData: {
            companyName: lead.companyName,
            status: lead.status,
            emailOpens: opens,
            emailClicks: clicks,
            emailReplies: replies,
          },
          dealData: lead.deals[0]
            ? {
                title: lead.deals[0].title,
                stage: lead.deals[0].stage,
                value: lead.deals[0].value,
              }
            : undefined,
        },
      });
    },
  },
  {
    name: 'search_team_members',
    description:
      'Search company teammates by name or email (employees and CRM users). Use before send_team_message.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name or email fragment' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
    execute: async (args, ctx) => {
      const q = String(args.query || '').trim();
      if (!q) return { members: [] };
      const limit = Math.min(Number(args.limit) || 10, 20);

      const [employees, users] = await Promise.all([
        prisma.employee.findMany({
          where: {
            companyId: ctx.companyId,
            status: { in: ['ACTIVE', 'PENDING'] },
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            name: true,
            email: true,
            jobTitle: true,
            department: true,
            userId: true,
          },
          take: limit,
        }),
        prisma.user.findMany({
          where: {
            AND: [
              {
                OR: [
                  { primaryCompanyId: ctx.companyId },
                  { companyId: ctx.companyId },
                  { userCompanies: { some: { companyId: ctx.companyId } } },
                ],
              },
              { role: { notIn: ['CUSTOMER'] } },
              {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                ],
              },
            ],
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            employeeProfile: { select: { id: true } },
          },
          take: limit,
        }),
      ]);

      return {
        members: [
          ...employees.map((e) => ({
            kind: 'employee' as const,
            employeeId: e.id,
            userId: e.userId,
            name: e.name,
            email: e.email,
            title: e.jobTitle,
            department: e.department,
          })),
          ...users.map((u) => ({
            kind: 'user' as const,
            userId: u.id,
            employeeId: u.employeeProfile?.id ?? null,
            name: u.name,
            email: u.email,
            role: u.role,
          })),
        ],
      };
    },
  },
  {
    name: 'send_team_message',
    description:
      'Send a direct message to a teammate (Employee DM when possible, otherwise assigns them a CRM task with the message). Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message body to send' },
        employeeId: { type: 'string', description: 'Receiver Employee.id if known' },
        userId: { type: 'string', description: 'Receiver User.id if known' },
        nameOrEmail: {
          type: 'string',
          description: 'Fallback lookup by name or email',
        },
      },
      required: ['message'],
    },
    execute: async (args, ctx) => {
      const body = String(args.message || '').trim();
      if (!body) throw new Error('message required');

      let receiverEmployeeId = args.employeeId ? String(args.employeeId) : '';
      let receiverUserId = args.userId ? String(args.userId) : '';
      let receiverName = '';

      if (!receiverEmployeeId && !receiverUserId && args.nameOrEmail) {
        const q = String(args.nameOrEmail).trim();
        const emp = await prisma.employee.findFirst({
          where: {
            companyId: ctx.companyId,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { equals: q, mode: 'insensitive' } },
            ],
          },
          select: { id: true, userId: true, name: true },
        });
        if (emp) {
          receiverEmployeeId = emp.id;
          receiverUserId = emp.userId || '';
          receiverName = emp.name;
        } else {
          const user = await prisma.user.findFirst({
            where: {
              AND: [
                {
                  OR: [
                    { primaryCompanyId: ctx.companyId },
                    { companyId: ctx.companyId },
                    { userCompanies: { some: { companyId: ctx.companyId } } },
                  ],
                },
                {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { email: { equals: q, mode: 'insensitive' } },
                  ],
                },
              ],
            },
            select: {
              id: true,
              name: true,
              employeeProfile: { select: { id: true } },
            },
          });
          if (user) {
            receiverUserId = user.id;
            receiverEmployeeId = user.employeeProfile?.id || '';
            receiverName = user.name || q;
          }
        }
      }

      if (receiverEmployeeId && !receiverName) {
        const emp = await prisma.employee.findFirst({
          where: { id: receiverEmployeeId, companyId: ctx.companyId },
          select: { id: true, userId: true, name: true },
        });
        if (!emp) throw new Error('Employee not found in this company');
        receiverName = emp.name;
        if (!receiverUserId) receiverUserId = emp.userId || '';
      }

      if (receiverUserId && !receiverName) {
        const user = await prisma.user.findFirst({
          where: {
            id: receiverUserId,
            OR: [
              { primaryCompanyId: ctx.companyId },
              { companyId: ctx.companyId },
              { userCompanies: { some: { companyId: ctx.companyId } } },
            ],
          },
          select: {
            id: true,
            name: true,
            employeeProfile: { select: { id: true } },
          },
        });
        if (!user) throw new Error('User not found in this company');
        receiverName = user.name || user.id;
        if (!receiverEmployeeId) receiverEmployeeId = user.employeeProfile?.id || '';
      }

      if (!receiverEmployeeId && !receiverUserId) {
        throw new Error('Could not resolve teammate — provide employeeId, userId, or nameOrEmail');
      }

      const senderEmployee = await prisma.employee.findFirst({
        where: { userId: ctx.userId, companyId: ctx.companyId },
        select: { id: true },
      });

      const channels: string[] = [];
      let dmId: string | null = null;

      if (senderEmployee?.id && receiverEmployeeId) {
        const dm = await prisma.employeeMessage.create({
          data: {
            content: `[OPS] ${body}`,
            senderId: senderEmployee.id,
            receiverId: receiverEmployeeId,
            type: 'TEXT',
            status: 'SENT',
          },
        });
        dmId = dm.id;
        channels.push('employee_dm');
      }

      if (receiverUserId) {
        const task = await prisma.task.create({
          data: {
            userId: ctx.userId,
            assignedToId: receiverUserId,
            title: `OPS message from ${ctx.userName || 'teammate'}`,
            description: body,
            type: 'TODO',
            priority: 'HIGH',
            status: 'PENDING',
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        channels.push('task');
        return {
          sent: true,
          receiverName,
          channels,
          dmId,
          taskId: task.id,
        };
      }

      return {
        sent: !!dmId,
        receiverName,
        channels,
        dmId,
        warning: dmId
          ? undefined
          : 'No linked user account — could not create task; DM may still have been sent.',
      };
    },
  },
];

export const AGENT_TOOLS: AgentToolDef[] = [...AGENT_TOOLS_BASE, ...EXTENDED_OPS_TOOLS];

export function getToolsForRole(role: string): AgentToolDef[] {
  return AGENT_TOOLS.filter((t) => {
    if (!t.roles || t.roles.length === 0) return true;
    return t.roles.includes(role) || role === 'SUPER_ADMIN';
  });
}

export function toGeminiFunctionDeclarations(tools: AgentToolDef[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export function getToolByName(name: string): AgentToolDef | undefined {
  return AGENT_TOOLS.find((t) => t.name === name);
}

export const confirmWriteSchema = z.object({
  toolRunId: z.string().min(1),
  action: z.enum(['confirm', 'reject']),
});
