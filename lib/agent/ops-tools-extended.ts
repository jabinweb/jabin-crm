import type { AgentToolDef } from '@/lib/agent/tool-types';
import { prisma } from '@/lib/prisma';
import { ticketService } from '@/lib/crm/ticket-service';
import { dealService } from '@/lib/crm/deal-service';
import { quotationService } from '@/lib/crm/quotation-service';
import { invoiceService } from '@/lib/crm/invoice-service';
import { listRenewalAlerts } from '@/lib/crm/service-contract-service';
import { whatsAppService } from '@/lib/crm/whatsapp-service';
import { calendarService } from '@/lib/crm/calendar-service';
import { sequenceService } from '@/lib/crm/sequence-service';
import { expenseService } from '@/lib/crm/expense-service';
import { customerService } from '@/lib/crm/customer-service';
import { slaService } from '@/lib/crm/sla-service';
import { serviceReportService } from '@/lib/crm/service-report-service';
import { notificationService } from '@/lib/crm/notification-service';
import { updateLeadStatus } from '@/lib/leads/leads';
import { sendEmail } from '@/lib/email/nodemailer';
import { generateColdEmail } from '@/lib/email/email-generator';
import { getUserSmtpConfig } from '@/lib/smtp-config';
import type {
  AttendanceStatus,
  DealStage,
  EmployeeStatus,
  ExpenseStatus,
  LeadStatus,
  LeaveStatus,
  Priority,
  TicketPriority,
  TicketStatus,
  WhatsAppChannel,
} from '@prisma/client';

function companyLeadWhere(companyId: string) {
  return {
    OR: [
      { companyId },
      { user: { primaryCompanyId: companyId } },
      { user: { userCompanies: { some: { companyId } } } },
    ],
  };
}

function companyInvoiceWhere(companyId: string) {
  return {
    OR: [
      { customer: { companyId } },
      { user: { primaryCompanyId: companyId } },
      { user: { userCompanies: { some: { companyId } } } },
    ],
  };
}

async function assertTicketInCompany(ticketId: string, companyId: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, customer: { companyId } },
    select: { id: true, subject: true, status: true, customerId: true },
  });
  if (!ticket) throw new Error('Ticket not found in this company');
  return ticket;
}

async function assertLeadInCompany(leadId: string, companyId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ...companyLeadWhere(companyId) },
    select: { id: true, companyName: true, status: true, email: true },
  });
  if (!lead) throw new Error('Lead not found in this company');
  return lead;
}

async function assertCustomerInCompany(customerId: string, companyId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: {
      id: true,
      organizationName: true,
      contactPerson: true,
      email: true,
      phone: true,
      billingCurrency: true,
    },
  });
  if (!customer) throw new Error('Customer not found in this company');
  return customer;
}

async function assertDealInCompany(dealId: string, companyId: string) {
  const deal = await prisma.deal.findFirst({
    where: {
      id: dealId,
      OR: [
        { lead: { companyId } },
        { user: { primaryCompanyId: companyId } },
      ],
    },
    select: { id: true, title: true, stage: true, value: true, leadId: true },
  });
  if (!deal) throw new Error('Deal not found in this company');
  return deal;
}

const TICKET_STATUSES: TicketStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];
const DEAL_STAGES: DealStage[] = [
  'PROSPECTING',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
];
const LEAD_STATUSES: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'RESPONDED',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'CONVERTED',
  'LOST',
  'ON_HOLD',
  'UNSUBSCRIBED',
];

export const EXTENDED_OPS_TOOLS: AgentToolDef[] = [
  // ── Reads ──────────────────────────────────────────────────────────────
  {
    name: 'get_customer',
    description: 'Get a customer/client profile by id, including open tickets and recent invoices.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { customerId: { type: 'string' } },
      required: ['customerId'],
    },
    execute: async (args, ctx) => {
      const customer = await assertCustomerInCompany(String(args.customerId), ctx.companyId);
      const [tickets, invoices, contracts] = await Promise.all([
        prisma.supportTicket.findMany({
          where: { customerId: customer.id, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
          select: { id: true, subject: true, status: true, priority: true },
          take: 10,
        }),
        prisma.invoice.findMany({
          where: { customerId: customer.id },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
            amountDue: true,
            currency: true,
            dueDate: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        prisma.serviceContract.findMany({
          where: { customerId: customer.id, companyId: ctx.companyId },
          select: { id: true, title: true, status: true, endDate: true, annualValue: true },
          take: 5,
        }),
      ]);
      return { customer, openTickets: tickets, recentInvoices: invoices, contracts };
    },
  },
  {
    name: 'get_ticket',
    description: 'Get support ticket details by id.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { ticketId: { type: 'string' } },
      required: ['ticketId'],
    },
    execute: async (args, ctx) => {
      const ticket = await prisma.supportTicket.findFirst({
        where: { id: String(args.ticketId), customer: { companyId: ctx.companyId } },
        include: {
          customer: { select: { id: true, organizationName: true, email: true } },
          assignedTechnician: { select: { id: true, name: true, email: true } },
        },
      });
      if (!ticket) throw new Error('Ticket not found');
      return { ticket };
    },
  },
  {
    name: 'get_lead',
    description: 'Get lead details by id.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { leadId: { type: 'string' } },
      required: ['leadId'],
    },
    execute: async (args, ctx) => {
      const lead = await prisma.lead.findFirst({
        where: { id: String(args.leadId), ...companyLeadWhere(ctx.companyId) },
        include: {
          deals: { take: 5, select: { id: true, title: true, stage: true, value: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      });
      if (!lead) throw new Error('Lead not found');
      return { lead };
    },
  },
  {
    name: 'get_deal',
    description: 'Get deal details by id.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { dealId: { type: 'string' } },
      required: ['dealId'],
    },
    execute: async (args, ctx) => {
      const deal = await prisma.deal.findFirst({
        where: {
          id: String(args.dealId),
          OR: [
            { lead: { companyId: ctx.companyId } },
            { user: { primaryCompanyId: ctx.companyId } },
          ],
        },
        include: {
          lead: { select: { id: true, companyName: true, email: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      });
      if (!deal) throw new Error('Deal not found');
      return { deal };
    },
  },
  {
    name: 'list_expiring_contracts',
    description: 'List active service contracts expiring soon (renewal alerts).',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        withinDays: { type: 'number', description: 'Horizon in days (default 60)' },
      },
    },
    execute: async (args, ctx) => {
      const withinDays = Math.min(Number(args.withinDays) || 60, 180);
      const alerts = await listRenewalAlerts(ctx.companyId, withinDays);
      return {
        contracts: alerts.map((c) => ({
          id: c.id,
          title: c.title,
          customerId: c.customerId,
          endDate: c.endDate,
          daysLeft: c.daysLeft,
          urgency: c.urgency,
          annualValue: c.annualValue,
          currency: c.currency,
        })),
      };
    },
  },
  {
    name: 'list_unassigned_tickets',
    description: 'List open tickets with no assigned technician.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
    execute: async (args, ctx) => {
      const limit = Math.min(Number(args.limit) || 15, 30);
      const tickets = await prisma.supportTicket.findMany({
        where: {
          customer: { companyId: ctx.companyId },
          assignedTechnicianId: null,
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
      return { tickets };
    },
  },
  {
    name: 'list_pending_expenses',
    description: 'List travel/field expenses awaiting approval for this company.',
    kind: 'read',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SUPPORT_MANAGER'],
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
    execute: async (args, ctx) => {
      const limit = Math.min(Number(args.limit) || 20, 40);
      const expenses = await prisma.travelExpense.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { user: { primaryCompanyId: ctx.companyId } },
            { user: { userCompanies: { some: { companyId: ctx.companyId } } } },
            { technician: { primaryCompanyId: ctx.companyId } },
          ],
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          category: true,
          description: true,
          expenseDate: true,
          technician: { select: { id: true, name: true, email: true } },
        },
        orderBy: { expenseDate: 'desc' },
        take: limit,
      });
      return { expenses };
    },
  },
  {
    name: 'list_email_sequences',
    description: 'List available email sequences to enroll leads into.',
    kind: 'read',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: async (_args, ctx) => {
      const sequences = await prisma.emailSequence.findMany({
        where: {
          OR: [
            { user: { primaryCompanyId: ctx.companyId } },
            { user: { userCompanies: { some: { companyId: ctx.companyId } } } },
            { userId: ctx.userId },
          ],
        },
        select: { id: true, name: true, status: true, description: true },
        take: 25,
      });
      return { sequences };
    },
  },
  {
    name: 'company_kpi_today',
    description: 'Quick KPI snapshot: tickets by status, overdue $, open pipeline value, pending quotes.',
    kind: 'read',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: async (_args, ctx) => {
      const [
        ticketsOpen,
        ticketsInProgress,
        overdueInvoices,
        pipeline,
        pendingQuotes,
        newLeads,
      ] = await Promise.all([
        prisma.supportTicket.count({
          where: {
            customer: { companyId: ctx.companyId },
            status: { in: ['OPEN', 'ASSIGNED'] },
          },
        }),
        prisma.supportTicket.count({
          where: {
            customer: { companyId: ctx.companyId },
            status: 'IN_PROGRESS',
          },
        }),
        prisma.invoice.aggregate({
          where: { ...companyInvoiceWhere(ctx.companyId), status: 'OVERDUE' },
          _sum: { amountDue: true },
          _count: true,
        }),
        prisma.deal.aggregate({
          where: {
            OR: [
              { lead: { companyId: ctx.companyId } },
              { user: { primaryCompanyId: ctx.companyId } },
            ],
            stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
          },
          _sum: { value: true },
          _count: true,
        }),
        prisma.quotation.count({
          where: {
            OR: [
              { customer: { companyId: ctx.companyId } },
              { user: { primaryCompanyId: ctx.companyId } },
            ],
            status: { in: ['SENT', 'VIEWED'] },
          },
        }),
        prisma.lead.count({
          where: { ...companyLeadWhere(ctx.companyId), status: 'NEW' },
        }),
      ]);
      return {
        ticketsOpen,
        ticketsInProgress,
        overdueInvoiceCount: overdueInvoices._count,
        overdueAmountDue: overdueInvoices._sum.amountDue || 0,
        openDeals: pipeline._count,
        openPipelineValue: pipeline._sum.value || 0,
        pendingQuotes,
        newLeads,
        currency: ctx.currency,
      };
    },
  },

  // ── Writes (confirm-gated) ─────────────────────────────────────────────
  {
    name: 'create_ticket',
    description: 'Create a support ticket for a customer. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        subject: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', description: 'LOW|MEDIUM|HIGH|CRITICAL' },
      },
      required: ['customerId', 'subject', 'description'],
    },
    execute: async (args, ctx) => {
      await assertCustomerInCompany(String(args.customerId), ctx.companyId);
      const priority = String(args.priority || 'MEDIUM').toUpperCase();
      const ticket = await ticketService.createTicket({
        customerId: String(args.customerId),
        subject: String(args.subject),
        description: String(args.description),
        companyId: ctx.companyId,
        priority: (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)
          ? priority
          : 'MEDIUM') as TicketPriority,
        channel: 'API',
      });
      return { ticket: { id: ticket.id, subject: ticket.subject, status: ticket.status } };
    },
  },
  {
    name: 'update_ticket_status',
    description: 'Update a ticket status. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        ticketId: { type: 'string' },
        status: {
          type: 'string',
          description: 'OPEN|ASSIGNED|IN_PROGRESS|RESOLVED|CLOSED',
        },
      },
      required: ['ticketId', 'status'],
    },
    execute: async (args, ctx) => {
      await assertTicketInCompany(String(args.ticketId), ctx.companyId);
      const status = String(args.status).toUpperCase() as TicketStatus;
      if (!TICKET_STATUSES.includes(status)) throw new Error('Invalid ticket status');
      const ticket = await ticketService.updateStatus(
        String(args.ticketId),
        status,
        ctx.userId
      );
      return { ticket: { id: ticket.id, status: ticket.status } };
    },
  },
  {
    name: 'assign_ticket',
    description: 'Assign/transfer a ticket to a technician user. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        ticketId: { type: 'string' },
        technicianUserId: { type: 'string', description: 'User.id of technician' },
        reason: { type: 'string' },
      },
      required: ['ticketId', 'technicianUserId'],
    },
    execute: async (args, ctx) => {
      await assertTicketInCompany(String(args.ticketId), ctx.companyId);
      const tech = await prisma.user.findFirst({
        where: {
          id: String(args.technicianUserId),
          OR: [
            { primaryCompanyId: ctx.companyId },
            { companyId: ctx.companyId },
            { userCompanies: { some: { companyId: ctx.companyId } } },
          ],
        },
        select: { id: true, name: true },
      });
      if (!tech) throw new Error('Technician user not found in company');
      const ticket = await ticketService.transferTicket(
        String(args.ticketId),
        tech.id,
        String(args.reason || 'Assigned via OPS'),
        ctx.userId
      );
      return {
        ticket: { id: ticket.id, assignedTechnicianId: ticket.assignedTechnicianId },
        technician: tech,
      };
    },
  },
  {
    name: 'create_deal',
    description: 'Create a deal on a lead. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        title: { type: 'string' },
        value: { type: 'number' },
        stage: { type: 'string' },
        currency: { type: 'string' },
      },
      required: ['leadId', 'title', 'value'],
    },
    execute: async (args, ctx) => {
      await assertLeadInCompany(String(args.leadId), ctx.companyId);
      const stage = String(args.stage || 'PROSPECTING').toUpperCase() as DealStage;
      const deal = await dealService.createDeal(ctx.userId, {
        leadId: String(args.leadId),
        title: String(args.title),
        value: Number(args.value),
        currency: args.currency ? String(args.currency) : ctx.currency,
        stage: DEAL_STAGES.includes(stage) ? stage : 'PROSPECTING',
      });
      return { deal: { id: deal.id, title: deal.title, stage: deal.stage, value: deal.value } };
    },
  },
  {
    name: 'update_deal_stage',
    description: 'Move a deal to a new pipeline stage. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        dealId: { type: 'string' },
        stage: {
          type: 'string',
          description:
            'PROSPECTING|QUALIFICATION|PROPOSAL|NEGOTIATION|CLOSED_WON|CLOSED_LOST',
        },
      },
      required: ['dealId', 'stage'],
    },
    execute: async (args, ctx) => {
      await assertDealInCompany(String(args.dealId), ctx.companyId);
      const stage = String(args.stage).toUpperCase() as DealStage;
      if (!DEAL_STAGES.includes(stage)) throw new Error('Invalid deal stage');
      const deal = await dealService.updateDeal(String(args.dealId), { stage });
      return { deal: { id: deal.id, stage: deal.stage, title: deal.title } };
    },
  },
  {
    name: 'update_lead_status',
    description: 'Update a lead status. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        status: { type: 'string' },
      },
      required: ['leadId', 'status'],
    },
    execute: async (args, ctx) => {
      await assertLeadInCompany(String(args.leadId), ctx.companyId);
      const status = String(args.status).toUpperCase() as LeadStatus;
      if (!LEAD_STATUSES.includes(status)) throw new Error('Invalid lead status');
      const lead = await updateLeadStatus(String(args.leadId), status, ctx.userId);
      return { lead: { id: lead.id, status: lead.status } };
    },
  },
  {
    name: 'assign_lead',
    description: 'Assign a lead to a CRM user. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        assigneeUserId: { type: 'string' },
      },
      required: ['leadId', 'assigneeUserId'],
    },
    execute: async (args, ctx) => {
      await assertLeadInCompany(String(args.leadId), ctx.companyId);
      const assignee = await prisma.user.findFirst({
        where: {
          id: String(args.assigneeUserId),
          OR: [
            { primaryCompanyId: ctx.companyId },
            { companyId: ctx.companyId },
            { userCompanies: { some: { companyId: ctx.companyId } } },
          ],
        },
        select: { id: true, name: true, email: true },
      });
      if (!assignee) throw new Error('Assignee not found in company');
      const lead = await prisma.lead.update({
        where: { id: String(args.leadId) },
        data: { assignedToId: assignee.id },
        select: { id: true, assignedToId: true, companyName: true },
      });
      return { lead, assignee };
    },
  },
  {
    name: 'create_quotation',
    description: 'Create a quotation (draft). Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        title: { type: 'string' },
        itemName: { type: 'string' },
        quantity: { type: 'number' },
        unitPrice: { type: 'number' },
        customerName: { type: 'string' },
        customerEmail: { type: 'string' },
      },
      required: ['title', 'itemName', 'unitPrice'],
    },
    execute: async (args, ctx) => {
      let customerName = args.customerName ? String(args.customerName) : '';
      let customerEmail = args.customerEmail ? String(args.customerEmail) : '';
      let customerId = args.customerId ? String(args.customerId) : undefined;
      if (customerId) {
        const c = await assertCustomerInCompany(customerId, ctx.companyId);
        customerName = customerName || c.organizationName;
        customerEmail = customerEmail || c.email || '';
      }
      if (!customerName || !customerEmail) {
        throw new Error('customerName and customerEmail required (or a valid customerId)');
      }
      const qty = Number(args.quantity) || 1;
      const unitPrice = Number(args.unitPrice);
      const quote = await quotationService.createQuotation({
        userId: ctx.userId,
        customerId,
        title: String(args.title),
        customerName,
        customerEmail,
        currency: ctx.currency,
        items: [
          {
            name: String(args.itemName),
            quantity: qty,
            unitPrice,
          },
        ],
      });
      return {
        quotation: {
          id: quote.id,
          quotationNumber: quote.quotationNumber,
          status: quote.status,
          total: quote.total,
        },
      };
    },
  },
  {
    name: 'send_quotation',
    description: 'Send a quotation to the customer by email. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: { quotationId: { type: 'string' } },
      required: ['quotationId'],
    },
    execute: async (args, ctx) => {
      const q = await prisma.quotation.findFirst({
        where: {
          id: String(args.quotationId),
          OR: [
            { customer: { companyId: ctx.companyId } },
            { user: { primaryCompanyId: ctx.companyId } },
            { userId: ctx.userId },
          ],
        },
        select: { id: true },
      });
      if (!q) throw new Error('Quotation not found');
      const sent = await quotationService.sendQuotation(q.id);
      return {
        quotation: {
          id: sent.id,
          status: sent.status,
          quotationNumber: sent.quotationNumber,
        },
      };
    },
  },
  {
    name: 'create_invoice',
    description: 'Create an invoice (draft). Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        title: { type: 'string' },
        itemName: { type: 'string' },
        quantity: { type: 'number' },
        unitPrice: { type: 'number' },
        customerName: { type: 'string' },
        customerEmail: { type: 'string' },
        dueInDays: { type: 'number' },
      },
      required: ['title', 'itemName', 'unitPrice'],
    },
    execute: async (args, ctx) => {
      let customerName = args.customerName ? String(args.customerName) : '';
      let customerEmail = args.customerEmail ? String(args.customerEmail) : '';
      let customerId = args.customerId ? String(args.customerId) : undefined;
      if (customerId) {
        const c = await assertCustomerInCompany(customerId, ctx.companyId);
        customerName = customerName || c.organizationName;
        customerEmail = customerEmail || c.email || '';
      }
      if (!customerName || !customerEmail) {
        throw new Error('customerName and customerEmail required (or a valid customerId)');
      }
      const invoice = await invoiceService.createInvoice({
        userId: ctx.userId,
        customerId,
        title: String(args.title),
        customerName,
        customerEmail,
        currency: ctx.currency,
        dueInDays: Number(args.dueInDays) || 15,
        items: [
          {
            name: String(args.itemName),
            quantity: Number(args.quantity) || 1,
            unitPrice: Number(args.unitPrice),
          },
        ],
      });
      return {
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          total: invoice.total,
        },
      };
    },
  },
  {
    name: 'send_invoice',
    description: 'Mark invoice as sent and email the customer. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: { invoiceId: { type: 'string' } },
      required: ['invoiceId'],
    },
    execute: async (args, ctx) => {
      const inv = await prisma.invoice.findFirst({
        where: { id: String(args.invoiceId), ...companyInvoiceWhere(ctx.companyId) },
        select: { id: true },
      });
      if (!inv) throw new Error('Invoice not found');
      const sent = await invoiceService.sendInvoice(inv.id);
      return {
        invoice: {
          id: sent.id,
          invoiceNumber: sent.invoiceNumber,
          status: sent.status,
        },
      };
    },
  },
  {
    name: 'enroll_lead_in_sequence',
    description: 'Enroll a lead into an email sequence. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        sequenceId: { type: 'string' },
      },
      required: ['leadId', 'sequenceId'],
    },
    execute: async (args, ctx) => {
      await assertLeadInCompany(String(args.leadId), ctx.companyId);
      const seq = await prisma.emailSequence.findFirst({
        where: {
          id: String(args.sequenceId),
          OR: [
            { userId: ctx.userId },
            { user: { primaryCompanyId: ctx.companyId } },
            { user: { userCompanies: { some: { companyId: ctx.companyId } } } },
          ],
        },
        select: { id: true, name: true },
      });
      if (!seq) throw new Error('Sequence not found');
      const enrollment = await sequenceService.enrollLead(seq.id, String(args.leadId));
      return { enrollment, sequence: seq };
    },
  },
  {
    name: 'schedule_calendar_event',
    description: 'Create a calendar event for the current user. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        startTime: { type: 'string', description: 'ISO datetime' },
        endTime: { type: 'string', description: 'ISO datetime' },
        description: { type: 'string' },
        leadId: { type: 'string' },
        dealId: { type: 'string' },
      },
      required: ['title', 'startTime', 'endTime'],
    },
    execute: async (args, ctx) => {
      const startTime = new Date(String(args.startTime));
      const endTime = new Date(String(args.endTime));
      if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
        throw new Error('Invalid startTime/endTime');
      }
      if (endTime <= startTime) throw new Error('endTime must be after startTime');
      const event = await calendarService.createEvent({
        userId: ctx.userId,
        title: String(args.title),
        startTime,
        endTime,
        description: args.description ? String(args.description) : undefined,
        leadId: args.leadId ? String(args.leadId) : undefined,
        dealId: args.dealId ? String(args.dealId) : undefined,
      });
      return { event: { id: event.id, title: event.title, startTime: event.startTime } };
    },
  },
  {
    name: 'send_whatsapp_message',
    description:
      'Send a WhatsApp message to a phone number (uses company WhatsApp config for this user). Requires confirmation. ADMIN/SALES preferred.',
    kind: 'write',
    roles: ['ADMIN', 'SUPER_ADMIN', 'SALES', 'MANAGER', 'SUPPORT_MANAGER'],
    parameters: {
      type: 'object',
      properties: {
        toPhone: { type: 'string' },
        message: { type: 'string' },
        channel: { type: 'string', description: 'SALES or SERVICE (default SERVICE)' },
        customerId: { type: 'string' },
        leadId: { type: 'string' },
        ticketId: { type: 'string' },
      },
      required: ['toPhone', 'message'],
    },
    execute: async (args, ctx) => {
      if (args.customerId) {
        await assertCustomerInCompany(String(args.customerId), ctx.companyId);
      }
      const channel = (
        String(args.channel || 'SERVICE').toUpperCase() === 'SALES' ? 'SALES' : 'SERVICE'
      ) as WhatsAppChannel;
      const result = await whatsAppService.sendMessage({
        userId: ctx.userId,
        toPhone: String(args.toPhone),
        message: String(args.message),
        channel,
        customerId: args.customerId ? String(args.customerId) : undefined,
        leadId: args.leadId ? String(args.leadId) : undefined,
        ticketId: args.ticketId ? String(args.ticketId) : undefined,
      });
      return { result };
    },
  },
  {
    name: 'approve_expense',
    description: 'Approve or reject a pending travel expense. Requires confirmation.',
    kind: 'write',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SUPPORT_MANAGER'],
    parameters: {
      type: 'object',
      properties: {
        expenseId: { type: 'string' },
        status: { type: 'string', description: 'APPROVED or REJECTED' },
        rejectionReason: { type: 'string' },
      },
      required: ['expenseId', 'status'],
    },
    execute: async (args, ctx) => {
      const status = String(args.status).toUpperCase() as ExpenseStatus;
      if (status !== 'APPROVED' && status !== 'REJECTED') {
        throw new Error('status must be APPROVED or REJECTED');
      }
      const expense = await prisma.travelExpense.findFirst({
        where: {
          id: String(args.expenseId),
          OR: [
            { user: { primaryCompanyId: ctx.companyId } },
            { user: { userCompanies: { some: { companyId: ctx.companyId } } } },
            { technician: { primaryCompanyId: ctx.companyId } },
          ],
        },
        select: { id: true },
      });
      if (!expense) throw new Error('Expense not found');
      const updated = await expenseService.updateExpenseStatus(
        expense.id,
        status,
        ctx.userId,
        args.rejectionReason ? String(args.rejectionReason) : undefined
      );
      return {
        expense: {
          id: updated.id,
          status: updated.status,
          amount: updated.amount,
        },
      };
    },
  },
  {
    name: 'create_announcement',
    description: 'Post a company announcement for employees. Requires confirmation. ADMIN only.',
    kind: 'write',
    roles: ['ADMIN', 'SUPER_ADMIN'],
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        priority: { type: 'number', description: '0 normal, higher = more urgent' },
      },
      required: ['title', 'content'],
    },
    execute: async (args, ctx) => {
      const ann = await prisma.announcement.create({
        data: {
          companyId: ctx.companyId,
          title: String(args.title),
          content: String(args.content),
          priority: Number(args.priority) || 0,
        },
      });
      return { announcement: { id: ann.id, title: ann.title } };
    },
  },

  // ── Gap coverage: contracts, SLA, field, email, HR, inventory ──────────
  {
    name: 'get_contract',
    description: 'Get a service contract (AMC/CMC) by id with customer and equipment.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { contractId: { type: 'string' } },
      required: ['contractId'],
    },
    execute: async (args, ctx) => {
      const contract = await prisma.serviceContract.findFirst({
        where: { id: String(args.contractId), companyId: ctx.companyId },
        include: {
          customer: {
            select: { id: true, organizationName: true, email: true, city: true },
          },
          equipment: {
            select: {
              id: true,
              serialNumber: true,
              product: { select: { name: true, modelNumber: true } },
            },
          },
        },
      });
      if (!contract) throw new Error('Contract not found');
      return { contract };
    },
  },
  {
    name: 'list_sla_breaches',
    description: 'List open tickets that have breached response or resolution SLA.',
    kind: 'read',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SUPPORT_MANAGER'],
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
    execute: async (args, ctx) => {
      const limit = Math.min(Number(args.limit) || 25, 50);
      const tickets = await prisma.supportTicket.findMany({
        where: {
          customer: { companyId: ctx.companyId },
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
          mergedIntoId: null,
        },
        select: { id: true },
        take: Math.min(limit * 4, 120),
        orderBy: { createdAt: 'asc' },
      });
      const statuses = await Promise.all(
        tickets.map((t) => slaService.getTicketSlaStatus(t.id))
      );
      const breached = statuses
        .filter((s) => s && (s.responseBreached || s.resolutionBreached))
        .slice(0, limit);
      return { breaches: breached };
    },
  },
  {
    name: 'list_technician_locations',
    description: 'Latest GPS locations for company technicians (last N hours).',
    kind: 'read',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SUPPORT_MANAGER'],
    parameters: {
      type: 'object',
      properties: {
        hours: { type: 'number', description: 'Lookback hours (default 8)' },
      },
    },
    execute: async (args, ctx) => {
      const hours = Math.min(Math.max(Number(args.hours) || 8, 1), 48);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const logs = await prisma.technicianLocationLog.findMany({
        where: {
          capturedAt: { gte: since },
          technician: {
            OR: [
              { primaryCompanyId: ctx.companyId },
              { companyId: ctx.companyId },
              { userCompanies: { some: { companyId: ctx.companyId } } },
            ],
          },
        },
        select: {
          id: true,
          latitude: true,
          longitude: true,
          capturedAt: true,
          ticketId: true,
          technician: { select: { id: true, name: true, email: true } },
        },
        orderBy: { capturedAt: 'desc' },
        take: 200,
      });
      const latestByTech = new Map<string, (typeof logs)[number]>();
      for (const log of logs) {
        const tid = log.technician.id;
        if (!latestByTech.has(tid)) latestByTech.set(tid, log);
      }
      return { locations: Array.from(latestByTech.values()), hours };
    },
  },
  {
    name: 'attendance_today',
    description: 'Company attendance summary for today (present, late, on leave, not arrived).',
    kind: 'read',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SUPPORT_MANAGER'],
    parameters: { type: 'object', properties: {}, required: [] },
    execute: async (_args, ctx) => {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const employees = await prisma.employee.findMany({
        where: {
          companyId: ctx.companyId,
          status: 'ACTIVE' as EmployeeStatus,
          isApproved: true,
        },
        select: { id: true, name: true, department: true },
      });
      const ids = employees.map((e) => e.id);
      type AttRow = {
        employeeId: string;
        status: AttendanceStatus;
        checkIn: Date | null;
        checkOut: Date | null;
      };
      const [attendanceRows, leaveRows] = await Promise.all([
        ids.length
          ? prisma.attendance.findMany({
              where: {
                employeeId: { in: ids },
                createdAt: { gte: dayStart, lt: dayEnd },
              },
              select: {
                employeeId: true,
                status: true,
                checkIn: true,
                checkOut: true,
              },
            })
          : Promise.resolve([] as AttRow[]),
        ids.length
          ? prisma.leaveRequest.findMany({
              where: {
                employeeId: { in: ids },
                status: 'APPROVED' as LeaveStatus,
                startDate: { lte: dayEnd },
                endDate: { gte: dayStart },
              },
              select: {
                employeeId: true,
                type: true,
                employee: { select: { name: true } },
              },
            })
          : Promise.resolve(
              [] as {
                employeeId: string;
                type: string;
                employee: { name: string };
              }[]
            ),
      ]);

      const onLeaveIds = new Set(leaveRows.map((l) => l.employeeId));
      const byEmp = new Map<string, AttRow>(
        attendanceRows.map((a) => [a.employeeId, a])
      );
      let present = 0;
      let late = 0;
      let notArrived = 0;
      let workingNow = 0;
      const lateList: { id: string; name: string; checkIn: Date | null }[] = [];
      const onLeaveList = leaveRows.map((l) => ({
        id: l.employeeId,
        name: l.employee.name,
        type: l.type,
      }));

      for (const emp of employees) {
        if (onLeaveIds.has(emp.id)) continue;
        const row = byEmp.get(emp.id);
        if (!row || !row.checkIn) {
          notArrived += 1;
          continue;
        }
        present += 1;
        const lateCheck =
          row.checkIn.getHours() > 10 ||
          (row.checkIn.getHours() === 10 && row.checkIn.getMinutes() > 0);
        if (lateCheck || row.status === ('LATE' as AttendanceStatus)) {
          late += 1;
          lateList.push({ id: emp.id, name: emp.name, checkIn: row.checkIn });
        }
        if (!row.checkOut) workingNow += 1;
      }

      return {
        rosterSize: employees.length,
        present,
        late,
        onLeave: onLeaveIds.size,
        notArrived,
        workingNow,
        attendancePercent:
          employees.length > 0
            ? Math.round((present / employees.length) * 100)
            : 0,
        lateList: lateList.slice(0, 15),
        onLeaveList: onLeaveList.slice(0, 15),
      };
    },
  },
  {
    name: 'list_unread_notifications',
    description: 'List unread notifications for the current user.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
    execute: async (args, ctx) => {
      const limit = Math.min(Number(args.limit) || 20, 40);
      const [notifications, unread] = await Promise.all([
        prisma.notification.findMany({
          where: { userId: ctx.userId, read: false },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            type: true,
            title: true,
            body: true,
            createdAt: true,
            metadata: true,
          },
        }),
        notificationService.unreadCount(ctx.userId),
      ]);
      return { notifications, unreadCount: unread };
    },
  },
  {
    name: 'search_documents',
    description: 'Search invoices, quotations, and service contracts by number/title/customer.',
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
      const q = String(args.query).trim();
      if (q.length < 2) throw new Error('query must be at least 2 characters');
      const limit = Math.min(Number(args.limit) || 10, 20);
      const [invoices, quotations, contracts] = await Promise.all([
        prisma.invoice.findMany({
          where: {
            ...companyInvoiceWhere(ctx.companyId),
            OR: [
              { invoiceNumber: { contains: q, mode: 'insensitive' } },
              { title: { contains: q, mode: 'insensitive' } },
              { customerName: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            invoiceNumber: true,
            title: true,
            status: true,
            total: true,
            currency: true,
            customerName: true,
          },
          take: limit,
        }),
        prisma.quotation.findMany({
          where: {
            OR: [
              { customer: { companyId: ctx.companyId } },
              { user: { primaryCompanyId: ctx.companyId } },
              { userId: ctx.userId },
            ],
            AND: [
              {
                OR: [
                  { quotationNumber: { contains: q, mode: 'insensitive' } },
                  { title: { contains: q, mode: 'insensitive' } },
                  { customerName: { contains: q, mode: 'insensitive' } },
                ],
              },
            ],
          },
          select: {
            id: true,
            quotationNumber: true,
            title: true,
            status: true,
            total: true,
            currency: true,
            customerName: true,
          },
          take: limit,
        }),
        prisma.serviceContract.findMany({
          where: {
            companyId: ctx.companyId,
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { contractNumber: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            contractNumber: true,
            title: true,
            status: true,
            annualValue: true,
            currency: true,
            endDate: true,
          },
          take: limit,
        }),
      ]);
      return {
        documents: [
          ...invoices.map((d) => ({ type: 'invoice' as const, ...d })),
          ...quotations.map((d) => ({ type: 'quotation' as const, ...d })),
          ...contracts.map((d) => ({ type: 'contract' as const, ...d })),
        ],
      };
    },
  },
  {
    name: 'list_assets',
    description: 'List company fixed assets.',
    kind: 'read',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
    execute: async (args, ctx) => {
      const limit = Math.min(Number(args.limit) || 25, 50);
      const assets = await prisma.asset.findMany({
        where: { companyId: ctx.companyId },
        orderBy: { purchaseDate: 'desc' },
        take: limit,
        select: {
          id: true,
          name: true,
          type: true,
          value: true,
          purchaseDate: true,
          depreciation: true,
        },
      });
      return { assets };
    },
  },
  {
    name: 'list_inventory',
    description: 'List products/stock levels; optionally only low-stock items.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        lowStockOnly: { type: 'boolean' },
        limit: { type: 'number' },
      },
    },
    execute: async (args, ctx) => {
      const limit = Math.min(Number(args.limit) || 30, 60);
      const products = await prisma.product.findMany({
        where: { companyId: ctx.companyId },
        select: {
          id: true,
          name: true,
          sku: true,
          quantity: true,
          minQuantity: true,
          reorderPoint: true,
          price: true,
          category: true,
        },
        orderBy: { name: 'asc' },
        take: 200,
      });
      const filtered = args.lowStockOnly
        ? products.filter(
            (p) =>
              p.quantity <= (p.reorderPoint || 0) ||
              p.quantity <= (p.minQuantity || 0)
          )
        : products;
      return { products: filtered.slice(0, limit) };
    },
  },
  {
    name: 'payroll_summary',
    description: 'Summarize payslips for a month/year. ADMIN only.',
    kind: 'read',
    roles: ['ADMIN', 'SUPER_ADMIN'],
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'number', description: '1-12 (default current month)' },
        year: { type: 'number', description: 'YYYY (default current year)' },
      },
    },
    execute: async (args, ctx) => {
      const now = new Date();
      const month = Number(args.month) || now.getMonth() + 1;
      const year = Number(args.year) || now.getFullYear();
      if (month < 1 || month > 12) throw new Error('month must be 1-12');
      const slips = await prisma.payslip.findMany({
        where: {
          month,
          year,
          employee: { companyId: ctx.companyId },
        },
        select: {
          id: true,
          netSalary: true,
          basicSalary: true,
          deductions: true,
          additions: true,
          isPaid: true,
          employee: { select: { id: true, name: true, email: true } },
        },
      });
      const totalNet = slips.reduce((s, p) => s + (p.netSalary || 0), 0);
      const totalBasic = slips.reduce((s, p) => s + (p.basicSalary || 0), 0);
      const paidCount = slips.filter((p) => p.isPaid).length;
      return {
        month,
        year,
        count: slips.length,
        totalNet,
        totalBasic,
        paidCount,
        unpaidCount: slips.length - paidCount,
        slips: slips.slice(0, 40),
      };
    },
  },
  {
    name: 'draft_email',
    description:
      'Draft an email (AI cold email for a lead, or return provided subject/body). Does not send.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'Optional lead for AI draft' },
        toEmail: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
        tone: { type: 'string', description: 'professional|casual|sales' },
      },
    },
    execute: async (args, ctx) => {
      if (args.leadId) {
        const lead = await prisma.lead.findFirst({
          where: { id: String(args.leadId), ...companyLeadWhere(ctx.companyId) },
          select: {
            companyName: true,
            contactName: true,
            industry: true,
            website: true,
            address: true,
            email: true,
          },
        });
        if (!lead) throw new Error('Lead not found');
        const toneRaw = String(args.tone || 'professional').toLowerCase();
        const tone =
          toneRaw === 'casual' || toneRaw === 'sales' ? toneRaw : 'professional';
        const draft = await generateColdEmail(
          lead,
          tone,
          ctx.companyName,
          undefined
        );
        return {
          toEmail: args.toEmail ? String(args.toEmail) : lead.email,
          subject: draft.subject,
          body: draft.body,
          mode: 'ai',
        };
      }
      if (!args.subject || !args.body) {
        throw new Error('Provide leadId for AI draft, or subject + body');
      }
      return {
        toEmail: args.toEmail ? String(args.toEmail) : null,
        subject: String(args.subject),
        body: String(args.body),
        mode: 'manual',
      };
    },
  },
  {
    name: 'send_email',
    description: 'Send an email via the user SMTP config. Requires confirmation.',
    kind: 'write',
    roles: ['ADMIN', 'SUPER_ADMIN', 'SALES', 'MANAGER', 'SUPPORT_MANAGER'],
    parameters: {
      type: 'object',
      properties: {
        toEmail: { type: 'string' },
        subject: { type: 'string' },
        bodyHtml: { type: 'string', description: 'HTML or plain text body' },
      },
      required: ['toEmail', 'subject', 'bodyHtml'],
    },
    execute: async (args, ctx) => {
      const smtp = await getUserSmtpConfig(ctx.userId);
      if (!smtp) throw new Error('SMTP not configured for this user');
      const html = String(args.bodyHtml);
      const result = await sendEmail({
        to: String(args.toEmail),
        subject: String(args.subject),
        html: html.includes('<') ? html : `<pre>${html}</pre>`,
        text: html.replace(/<[^>]*>/g, ''),
        from: smtp.from || smtp.user,
        smtpConfig: {
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          user: smtp.user,
          password: smtp.password,
        },
      });
      return { sent: true, messageId: result.messageId };
    },
  },
  {
    name: 'pause_sequence',
    description: 'Pause an active sequence enrollment for a lead. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        enrollmentId: { type: 'string' },
        leadId: { type: 'string', description: 'With sequenceId if enrollmentId unknown' },
        sequenceId: { type: 'string' },
      },
    },
    execute: async (args, ctx) => {
      let enrollmentId = args.enrollmentId ? String(args.enrollmentId) : '';
      if (!enrollmentId) {
        if (!args.leadId || !args.sequenceId) {
          throw new Error('Provide enrollmentId, or leadId + sequenceId');
        }
        await assertLeadInCompany(String(args.leadId), ctx.companyId);
        const found = await prisma.sequenceEnrollment.findFirst({
          where: {
            leadId: String(args.leadId),
            sequenceId: String(args.sequenceId),
            status: 'ACTIVE',
          },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
        });
        if (!found) throw new Error('Active enrollment not found');
        enrollmentId = found.id;
      }
      const enrollment = await prisma.sequenceEnrollment.findFirst({
        where: {
          id: enrollmentId,
          lead: companyLeadWhere(ctx.companyId),
        },
        select: { id: true, status: true, leadId: true, sequenceId: true },
      });
      if (!enrollment) throw new Error('Enrollment not found');
      const updated = await sequenceService.pauseEnrollment(enrollment.id);
      return {
        enrollment: {
          id: updated.id,
          status: updated.status,
          leadId: enrollment.leadId,
          sequenceId: enrollment.sequenceId,
        },
      };
    },
  },
  {
    name: 'create_service_report',
    description:
      'File a service report for a ticket (marks ticket RESOLVED). Requires confirmation.',
    kind: 'write',
    roles: ['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'MANAGER'],
    parameters: {
      type: 'object',
      properties: {
        ticketId: { type: 'string' },
        serviceNotes: { type: 'string' },
        technicianUserId: {
          type: 'string',
          description: 'Defaults to current user',
        },
        partsReplaced: { type: 'string' },
      },
      required: ['ticketId', 'serviceNotes'],
    },
    execute: async (args, ctx) => {
      const ticket = await assertTicketInCompany(String(args.ticketId), ctx.companyId);
      const technicianId = args.technicianUserId
        ? String(args.technicianUserId)
        : ctx.userId;
      const tech = await prisma.user.findFirst({
        where: {
          id: technicianId,
          OR: [
            { primaryCompanyId: ctx.companyId },
            { companyId: ctx.companyId },
            { userCompanies: { some: { companyId: ctx.companyId } } },
          ],
        },
        select: { id: true, name: true },
      });
      if (!tech) throw new Error('Technician not found in company');
      const report = await serviceReportService.createReport({
        ticketId: ticket.id,
        technicianId: tech.id,
        serviceNotes: String(args.serviceNotes),
        partsReplaced: args.partsReplaced ? String(args.partsReplaced) : undefined,
      });
      return {
        report: { id: report.id, ticketId: report.ticketId },
        ticketResolved: true,
        technician: tech,
      };
    },
  },
  {
    name: 'create_customer',
    description: 'Create a customer/client record. Requires confirmation.',
    kind: 'write',
    roles: ['ADMIN', 'SUPER_ADMIN', 'SALES', 'MANAGER'],
    parameters: {
      type: 'object',
      properties: {
        organizationName: { type: 'string' },
        contactPerson: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        city: { type: 'string' },
        industry: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['organizationName', 'contactPerson'],
    },
    execute: async (args, ctx) => {
      const customer = await customerService.createCustomer({
        organizationName: String(args.organizationName),
        contactPerson: String(args.contactPerson),
        email: args.email ? String(args.email) : undefined,
        phone: args.phone ? String(args.phone) : undefined,
        city: args.city ? String(args.city) : undefined,
        industry: args.industry ? String(args.industry) : undefined,
        notes: args.notes ? String(args.notes) : undefined,
        companyId: ctx.companyId,
      });
      return {
        customer: {
          id: customer.id,
          organizationName: customer.organizationName,
          email: customer.email,
        },
      };
    },
  },
  {
    name: 'create_lead',
    description: 'Create a new lead. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        companyName: { type: 'string' },
        name: { type: 'string', description: 'Contact name' },
        email: { type: 'string' },
        phone: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', description: 'LOW|MEDIUM|HIGH|CRITICAL' },
      },
      required: ['companyName'],
    },
    execute: async (args, ctx) => {
      const priorityRaw = String(args.priority || 'MEDIUM').toUpperCase();
      const priority = (
        ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priorityRaw)
          ? priorityRaw
          : 'MEDIUM'
      ) as Priority;
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { employeeId: true },
      });
      const lead = await prisma.lead.create({
        data: {
          companyName: String(args.companyName),
          name: args.name ? String(args.name) : undefined,
          contactName: args.name ? String(args.name) : undefined,
          email: args.email ? String(args.email) : undefined,
          phone: args.phone ? String(args.phone) : undefined,
          description: args.description ? String(args.description) : undefined,
          source: 'OPS_AGENT',
          priority,
          companyId: ctx.companyId,
          userId: ctx.userId,
          employeeId: user?.employeeId || undefined,
          status: 'NEW',
        },
        select: {
          id: true,
          companyName: true,
          status: true,
          email: true,
        },
      });
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          activityType: 'NOTE_ADDED',
          description: 'Lead created via OPS',
          userId: ctx.userId,
        },
      });
      return { lead };
    },
  },
];
