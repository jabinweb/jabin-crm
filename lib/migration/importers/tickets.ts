import type { TicketChannel, TicketPriority, TicketStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { customerService } from '@/lib/crm/customer-service';
import { ticketService } from '@/lib/crm/ticket-service';
import { findCustomerIdByEmail } from '../dedupe';
import { cell, normalizeEmail, normalizeTags } from '../parse-csv';
import type {
  ColumnMapping,
  CsvRow,
  ExecuteResult,
  ImportOptions,
  ImportSummary,
  RunImportContext,
  RowError,
} from '../types';

const PRIORITIES = new Set<TicketPriority>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const STATUSES = new Set<TicketStatus>([
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
]);
const CHANNELS = new Set<TicketChannel>([
  'EMAIL',
  'PORTAL',
  'PHONE',
  'WHATSAPP',
  'CHAT',
  'API',
]);

function normalizePriority(value: string | undefined): TicketPriority {
  if (!value) return 'MEDIUM';
  const n = value.trim().toUpperCase().replace(/\s+/g, '_') as TicketPriority;
  return PRIORITIES.has(n) ? n : 'MEDIUM';
}

function normalizeStatus(value: string | undefined): TicketStatus | undefined {
  if (!value) return undefined;
  const n = value.trim().toUpperCase().replace(/\s+/g, '_') as TicketStatus;
  return STATUSES.has(n) ? n : undefined;
}

function normalizeChannel(value: string | undefined): TicketChannel {
  if (!value) return 'API';
  const n = value.trim().toUpperCase().replace(/\s+/g, '_') as TicketChannel;
  return CHANNELS.has(n) ? n : 'API';
}

export async function importTickets(
  rows: CsvRow[],
  mapping: ColumnMapping,
  ctx: RunImportContext,
  options: ImportOptions = {}
): Promise<ExecuteResult> {
  const errors: RowError[] = [];
  const createdIds: string[] = [];
  let imported = 0;
  let skippedMissingRequired = 0;
  let skippedUnresolved = 0;
  const emailToCustomerId = new Map<string, string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const subject = cell(row, mapping.subject);
    const description = cell(row, mapping.description);
    const email = normalizeEmail(cell(row, mapping.email));

    if (!subject || !description || !email) {
      skippedMissingRequired += 1;
      continue;
    }

    try {
      let customerId = emailToCustomerId.get(email) ?? null;
      if (!customerId) {
        customerId = await findCustomerIdByEmail(ctx.companyId, email);
        if (customerId) emailToCustomerId.set(email, customerId);
      }

      if (!customerId && options.createMissingCustomers) {
        const organizationName =
          cell(row, mapping.organizationName) || email.split('@')[1] || 'Imported customer';
        const contactPerson = cell(row, mapping.contactPerson) || email.split('@')[0] || 'Contact';
        const created = await customerService.createCustomer({
          organizationName,
          contactPerson,
          email,
          companyId: ctx.companyId,
          notes: 'Auto-created during ticket CSV import',
        });
        customerId = created.id;
        emailToCustomerId.set(email, created.id);
      }

      if (!customerId) {
        skippedUnresolved += 1;
        continue;
      }

      const resolvedCustomerId = customerId;
      const status = normalizeStatus(cell(row, mapping.status));
      const ticket = await ticketService.createTicket({
        customerId: resolvedCustomerId,
        subject,
        description,
        priority: normalizePriority(cell(row, mapping.priority)),
        channel: normalizeChannel(cell(row, mapping.channel)),
        tags: normalizeTags(cell(row, mapping.tags)),
        ticketType: cell(row, mapping.ticketType),
        companyId: ctx.companyId,
      });

      if (status && status !== ticket.status) {
        await prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { status },
        });
      }

      createdIds.push(ticket.id);
      imported += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Failed to import row',
      });
    }
  }

  const summary: ImportSummary = {
    totalRows: rows.length,
    imported,
    skippedDuplicates: 0,
    skippedMissingRequired,
    skippedUnresolved,
    failed: errors.length,
  };

  return {
    success: true,
    object: 'tickets',
    summary,
    createdIds,
    errors,
  };
}
