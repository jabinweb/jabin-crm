import { LeadStatus } from '@prisma/client';
import { afterLeadCreated } from '@/lib/api/module-guard';
import { checkUsageLimits } from '@/lib/subscription';
import { prisma } from '@/lib/prisma';
import { loadExistingLeadEmails } from '../dedupe';
import { cell, normalizeEmail, normalizeTags } from '../parse-csv';
import type {
  ColumnMapping,
  CsvRow,
  ExecuteResult,
  ImportSummary,
  RunImportContext,
  RowError,
} from '../types';

const LEAD_STATUSES = new Set<LeadStatus>([
  'NEW',
  'CONTACTED',
  'RESPONDED',
  'QUALIFIED',
  'CONVERTED',
  'LOST',
  'UNSUBSCRIBED',
]);

function normalizeStatus(value: string | undefined): LeadStatus {
  if (!value) return 'NEW';
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_') as LeadStatus;
  return LEAD_STATUSES.has(normalized) ? normalized : 'NEW';
}

export async function importLeads(
  rows: CsvRow[],
  mapping: ColumnMapping,
  ctx: RunImportContext
): Promise<ExecuteResult> {
  const errors: RowError[] = [];
  const createdIds: string[] = [];
  let imported = 0;
  let skippedDuplicates = 0;
  let skippedMissingRequired = 0;

  const parsed = rows.map((row, index) => {
    const companyName = cell(row, mapping.companyName);
    const email = normalizeEmail(cell(row, mapping.email));
    return {
      rowNumber: index + 2,
      companyName,
      contactName: cell(row, mapping.contactName),
      email,
      phone: cell(row, mapping.phone),
      website: cell(row, mapping.website),
      address: cell(row, mapping.address),
      city: cell(row, mapping.city),
      state: cell(row, mapping.state),
      country: cell(row, mapping.country),
      zipCode: cell(row, mapping.zipCode),
      industry: cell(row, mapping.industry),
      jobTitle: cell(row, mapping.jobTitle),
      description: cell(row, mapping.description),
      source: cell(row, mapping.source) || 'CSV Import',
      sourceUrl: cell(row, mapping.sourceUrl) || '',
      status: normalizeStatus(cell(row, mapping.status)),
      tags: normalizeTags(cell(row, mapping.tags)),
    };
  });

  const withCompany = parsed.filter((r) => r.companyName);
  const limits = await checkUsageLimits(ctx.userId);
  if (limits.leadsRemaining !== -1 && withCompany.length > limits.leadsRemaining) {
    throw new Error(
      `Lead limit would be exceeded. You can import at most ${limits.leadsRemaining} more lead(s).`
    );
  }

  const emails = Array.from(
    new Set(withCompany.map((r) => r.email).filter((e): e is string => !!e))
  );
  const existingEmails = await loadExistingLeadEmails(ctx.companyId, emails);
  const seenInFile = new Set<string>();

  for (const row of parsed) {
    if (!row.companyName) {
      skippedMissingRequired += 1;
      continue;
    }

    if (row.email && (existingEmails.has(row.email) || seenInFile.has(row.email))) {
      skippedDuplicates += 1;
      continue;
    }

    try {
      const lead = await prisma.lead.create({
        data: {
          companyName: row.companyName,
          contactName: row.contactName || null,
          name: row.contactName || row.companyName,
          email: row.email || null,
          phone: row.phone || null,
          website: row.website || null,
          address: row.address || null,
          city: row.city || null,
          state: row.state || null,
          country: row.country || null,
          zipCode: row.zipCode || null,
          industry: row.industry || null,
          jobTitle: row.jobTitle || null,
          description: row.description || null,
          source: row.source,
          sourceUrl: row.sourceUrl,
          status: row.status,
          tags: row.tags,
          userId: ctx.userId,
          companyId: ctx.companyId,
          ...(ctx.employeeId ? { employeeId: ctx.employeeId } : {}),
        },
        select: { id: true },
      });

      createdIds.push(lead.id);
      imported += 1;
      await afterLeadCreated(ctx.userId, {
        leadId: lead.id,
        companyId: ctx.companyId,
        summary: `Lead imported: ${row.companyName}`,
      });
      if (row.email) {
        seenInFile.add(row.email);
        existingEmails.add(row.email);
      }
    } catch (error) {
      errors.push({
        row: row.rowNumber,
        message: error instanceof Error ? error.message : 'Failed to import row',
      });
    }
  }

  const summary: ImportSummary = {
    totalRows: parsed.length,
    imported,
    skippedDuplicates,
    skippedMissingRequired,
    skippedUnresolved: 0,
    failed: errors.length,
    skippedMissingCompany: skippedMissingRequired,
  };

  return {
    success: true,
    object: 'leads',
    summary,
    createdIds,
    errors,
  };
}
