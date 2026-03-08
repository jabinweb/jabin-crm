import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { LeadStatus } from '@prisma/client';
import { requireAuth } from '@/lib/auth-middleware';
import { ApiErrors, handleApiError } from '@/lib/api-error-handler';
import { prisma } from '@/lib/prisma';

type CsvRow = Record<string, string>;

const LEAD_STATUSES = new Set<LeadStatus>([
  'NEW',
  'CONTACTED',
  'RESPONDED',
  'QUALIFIED',
  'CONVERTED',
  'LOST',
  'UNSUBSCRIBED',
]);

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

function pickValue(row: CsvRow, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeStatus(value: string | undefined): LeadStatus {
  if (!value) return 'NEW';
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_') as LeadStatus;
  return LEAD_STATUSES.has(normalized) ? normalized : 'NEW';
}

function normalizeTags(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEmail(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const email = value.trim().toLowerCase();
  return email.length > 0 ? email : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const formData = await req.formData();
    const csvFile = formData.get('file');

    if (!(csvFile instanceof File)) {
      throw ApiErrors.badRequest('CSV file is required');
    }

    if (csvFile.size === 0) {
      throw ApiErrors.badRequest('CSV file is empty');
    }

    const csvText = await csvFile.text();
    const parsed = Papa.parse<CsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
    });

    if (parsed.errors.length > 0) {
      throw ApiErrors.badRequest(`CSV parsing failed: ${parsed.errors[0]?.message || 'Invalid CSV format'}`);
    }

    if (!parsed.data.length) {
      throw ApiErrors.badRequest('CSV contains no data rows');
    }

    if (parsed.data.length > 5000) {
      throw ApiErrors.badRequest('CSV row limit exceeded. Maximum 5000 rows per import.');
    }

    const normalizedRows = parsed.data.map((row, index) => {
      const companyName = pickValue(row, ['company_name', 'company', 'account_name', 'name']);
      const email = normalizeEmail(pickValue(row, ['email', 'work_email', 'contact_email']));
      const phone = pickValue(row, ['phone', 'mobile', 'contact_phone']);

      return {
        rowNumber: index + 2,
        companyName,
        contactName: pickValue(row, ['contact_name', 'contact', 'person_name']),
        email,
        phone,
        website: pickValue(row, ['website', 'site', 'url']),
        address: pickValue(row, ['address', 'street_address']),
        city: pickValue(row, ['city']),
        state: pickValue(row, ['state']),
        country: pickValue(row, ['country']),
        zipCode: pickValue(row, ['zip_code', 'zipcode', 'postal_code']),
        industry: pickValue(row, ['industry']),
        jobTitle: pickValue(row, ['job_title', 'designation', 'title']),
        description: pickValue(row, ['description', 'notes', 'note']),
        source: pickValue(row, ['source']) || 'CSV Import',
        sourceUrl: pickValue(row, ['source_url', 'source_link']),
        status: normalizeStatus(pickValue(row, ['status', 'lead_status'])),
        tags: normalizeTags(pickValue(row, ['tags', 'labels'])),
      };
    });

    const validRows = normalizedRows.filter((row) => row.companyName);
    if (!validRows.length) {
      throw ApiErrors.badRequest('No valid rows found. "companyName" (or "company") is required.');
    }

    const emails = Array.from(
      new Set(validRows.map((row) => row.email).filter((email): email is string => !!email))
    );

    const existingLeads = emails.length
      ? await prisma.lead.findMany({
          where: {
            userId: session.user.id,
            email: { in: emails },
          },
          select: { email: true },
        })
      : [];

    const existingEmails = new Set(
      existingLeads
        .map((lead) => lead.email?.toLowerCase().trim())
        .filter((email): email is string => !!email)
    );

    const duplicateEmails = new Set<string>();
    const createdLeadIds: string[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    let skippedMissingCompany = 0;
    let skippedDuplicates = 0;
    let imported = 0;

    for (const row of normalizedRows) {
      if (!row.companyName) {
        skippedMissingCompany += 1;
        continue;
      }

      if (row.email && (existingEmails.has(row.email) || duplicateEmails.has(row.email))) {
        skippedDuplicates += 1;
        continue;
      }

      try {
        const lead = await prisma.lead.create({
          data: {
            companyName: row.companyName,
            contactName: row.contactName || null,
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
            sourceUrl: row.sourceUrl || '',
            status: row.status,
            tags: row.tags,
            userId: session.user.id,
          },
          select: { id: true },
        });

        createdLeadIds.push(lead.id);
        imported += 1;
        if (row.email) {
          duplicateEmails.add(row.email);
        }
      } catch (error) {
        errors.push({
          row: row.rowNumber,
          message: error instanceof Error ? error.message : 'Failed to import row',
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: normalizedRows.length,
        imported,
        skippedDuplicates,
        skippedMissingCompany,
        failed: errors.length,
      },
      createdLeadIds,
      errors,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
