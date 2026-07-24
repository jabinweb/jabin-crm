import { customerService } from '@/lib/crm/customer-service';
import {
  customerOrgKey,
  loadExistingCustomerEmails,
  loadExistingCustomerOrgKeys,
} from '../dedupe';
import { cell, normalizeEmail } from '../parse-csv';
import type {
  ColumnMapping,
  CsvRow,
  ExecuteResult,
  ImportSummary,
  RunImportContext,
  RowError,
} from '../types';

export async function importCustomers(
  rows: CsvRow[],
  mapping: ColumnMapping,
  ctx: RunImportContext
): Promise<ExecuteResult> {
  const errors: RowError[] = [];
  const createdIds: string[] = [];
  let imported = 0;
  let skippedDuplicates = 0;
  let skippedMissingRequired = 0;

  const existingEmails = await loadExistingCustomerEmails(
    ctx.companyId,
    Array.from(
      new Set(
        rows
          .map((row) => normalizeEmail(cell(row, mapping.email)))
          .filter((e): e is string => !!e)
      )
    )
  );
  const existingOrgKeys = await loadExistingCustomerOrgKeys(ctx.companyId);
  const seenEmails = new Set<string>();
  const seenOrgKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const organizationName = cell(row, mapping.organizationName);
    const contactPerson = cell(row, mapping.contactPerson);
    const email = normalizeEmail(cell(row, mapping.email));

    if (!organizationName || !contactPerson) {
      skippedMissingRequired += 1;
      continue;
    }

    const orgKey = customerOrgKey(organizationName, contactPerson);
    if (
      (email && (existingEmails.has(email) || seenEmails.has(email))) ||
      existingOrgKeys.has(orgKey) ||
      seenOrgKeys.has(orgKey)
    ) {
      skippedDuplicates += 1;
      continue;
    }

    try {
      const customer = await customerService.createCustomer({
        organizationName,
        contactPerson,
        email,
        phone: cell(row, mapping.phone),
        address: cell(row, mapping.address),
        city: cell(row, mapping.city),
        state: cell(row, mapping.state),
        industry: cell(row, mapping.industry),
        accountType: cell(row, mapping.accountType),
        notes: cell(row, mapping.notes),
        companyId: ctx.companyId,
      });

      createdIds.push(customer.id);
      imported += 1;
      seenOrgKeys.add(orgKey);
      existingOrgKeys.add(orgKey);
      if (email) {
        seenEmails.add(email);
        existingEmails.add(email);
      }
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
    skippedDuplicates,
    skippedMissingRequired,
    skippedUnresolved: 0,
    failed: errors.length,
  };

  return {
    success: true,
    object: 'customers',
    summary,
    createdIds,
    errors,
  };
}
