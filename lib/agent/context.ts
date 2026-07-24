import { prisma } from '@/lib/prisma';
import {
  workspaceSettingsFromCompanySettings,
  resolveWorkspaceConfig,
} from '@/lib/workspace-config';
import { companyDefaultCurrencyFromSettings } from '@/lib/currency/resolve';

export type AgentRuntimeContext = {
  companyId: string;
  companyName: string;
  companySlug: string;
  userId: string;
  userName: string | null;
  userRole: string;
  currency: string;
  verticalLabel: string;
  terminology: Record<string, string>;
  snapshot: {
    openTickets: number;
    overdueInvoices: number;
    openDeals: number;
    pendingQuotes: number;
    dueTasks: number;
  };
};

export async function buildAgentContext(params: {
  companyId: string;
  userId: string;
  userRole: string;
  userName?: string | null;
}): Promise<AgentRuntimeContext> {
  const company = await prisma.company.findUnique({
    where: { id: params.companyId },
    select: { id: true, name: true, slug: true, settings: true },
  });
  if (!company) throw new Error('Company not found');

  const workspace = resolveWorkspaceConfig(
    workspaceSettingsFromCompanySettings(company.settings)
  );
  const currency = companyDefaultCurrencyFromSettings(company.settings) || 'INR';

  const now = new Date();
  const [
    openTickets,
    overdueInvoices,
    openDeals,
    pendingQuotes,
    dueTasks,
  ] = await Promise.all([
    prisma.supportTicket.count({
      where: {
        customer: { companyId: company.id },
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      },
    }).catch(() => 0),
    prisma.invoice.count({
      where: {
        OR: [
          { customer: { companyId: company.id } },
          { user: { primaryCompanyId: company.id } },
        ],
        status: 'OVERDUE',
      },
    }).catch(() => 0),
    prisma.deal.count({
      where: {
        OR: [
          { lead: { companyId: company.id } },
          { user: { primaryCompanyId: company.id } },
        ],
        stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
      },
    }).catch(() => 0),
    prisma.quotation.count({
      where: {
        OR: [
          { customer: { companyId: company.id } },
          { user: { primaryCompanyId: company.id } },
        ],
        status: { in: ['SENT', 'VIEWED'] },
      },
    }).catch(() => 0),
    prisma.task.count({
      where: {
        userId: params.userId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        dueDate: { lte: now },
      },
    }).catch(() => 0),
  ]);

  return {
    companyId: company.id,
    companyName: company.name,
    companySlug: company.slug,
    userId: params.userId,
    userName: params.userName ?? null,
    userRole: params.userRole,
    currency,
    verticalLabel: workspace.verticalLabel,
    terminology: workspace.terminology as unknown as Record<string, string>,
    snapshot: {
      openTickets,
      overdueInvoices,
      openDeals,
      pendingQuotes,
      dueTasks,
    },
  };
}

export function buildSystemPrompt(
  ctx: AgentRuntimeContext,
  extra?: string | null
): string {
  return [
    `You are OPS — ${ctx.companyName}'s internal company operator for the Opslane workspace.`,
    `Company slug: ${ctx.companySlug}. Vertical: ${ctx.verticalLabel}. Default currency: ${ctx.currency}.`,
    `You help ${ctx.userName || 'the user'} (role: ${ctx.userRole}) run the business using tools.`,
    `Terminology: lead=${ctx.terminology.lead || 'Lead'}, deal=${ctx.terminology.deal || 'Deal'}, ticket=${ctx.terminology.ticket || 'Ticket'}.`,
    `Today snapshot: open tickets=${ctx.snapshot.openTickets}, overdue invoices=${ctx.snapshot.overdueInvoices}, open deals=${ctx.snapshot.openDeals}, pending quotes=${ctx.snapshot.pendingQuotes}, your overdue tasks=${ctx.snapshot.dueTasks}.`,
    `Rules:`,
    `- Use tools for live data. Never invent IDs, amounts, or counts.`,
    `- Prefer concise, actionable answers with entity IDs and next steps.`,
    `- You can operate the whole company: customers, leads, deals, tickets, quotes, invoices, contracts, SLA, field GPS/attendance, expenses, payroll (ADMIN), inventory/assets, calendar, sequences, WhatsApp/email, announcements, and teammate DMs.`,
    `- Write tools require user confirmation in the UI before they run — call them when appropriate.`,
    `- Prefer get_*/list_*/search_* before writes. Always use real IDs from tools or @tags — never invent them.`,
    `- When the user sends a screenshot/image, read visible text/IDs/errors, then act with tools.`,
    `- For teammate messaging: search_team_members or @tags, then send_team_message.`,
    `- For customers: create_customer / get_customer / search_customers; for tickets: create_ticket, assign_ticket, update_ticket_status, create_service_report.`,
    `- Money moves (record_invoice_payment, send_invoice, approve_expense, payroll_summary) and WhatsApp/email sends are especially sensitive — confirm-gated.`,
    `- Stay within this company. Do not discuss other tenants.`,
    `- If a request is ambiguous, ask one clarifying question.`,
    extra ? `Company notes: ${extra}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
