import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createObjectCsvStringifier } from 'csv-writer';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { resolveCompanyContextFromRequest, TenantError } from '@/lib/auth/company-membership';

/** Neutralise spreadsheet formula injection (=, +, -, @, tab, CR at cell start). */
function csvSafe(value: unknown): unknown {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const session = await withModuleAccess('LEADS');
    const { companyId } = await resolveCompanyContextFromRequest(session, request);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const search = searchParams.get('search') || '';
    const industry = searchParams.get('industry') || '';

    const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? [];

    const where = {
      userId: session.user.id,
      companyId,
      ...(ids.length > 0 && { id: { in: ids } }),
      ...(search && {
        OR: [
          { companyName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { contactName: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(industry && { industry: { contains: industry, mode: 'insensitive' } }),
    };

    const leads = await prisma.lead.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'csv') {
      // Build in memory: the deployment filesystem may be read-only.
      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: 'companyName', title: 'Company Name' },
          { id: 'contactName', title: 'Contact Name' },
          { id: 'email', title: 'Email' },
          { id: 'phone', title: 'Phone' },
          { id: 'website', title: 'Website' },
          { id: 'industry', title: 'Industry' },
          { id: 'employeeCount', title: 'Employee Count' },
          { id: 'address', title: 'Address' },
          { id: 'linkedinUrl', title: 'LinkedIn' },
          { id: 'source', title: 'Source' },
          { id: 'createdAt', title: 'Created At' },
        ],
      });

      const rows = leads.map((lead) =>
        Object.fromEntries(Object.entries(lead).map(([k, v]) => [k, csvSafe(v)]))
      );
      const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(rows);

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="leads.csv"',
        },
      });
    }

    // Default to JSON
    return NextResponse.json(leads);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isApiException(error)) return handleApiError(error);
    console.error('Error exporting leads:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
