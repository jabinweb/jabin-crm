import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors, handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';
import { runImport } from '@/lib/migration';

/**
 * Thin wrapper around the shared migration engine so the leads toolbar
 * keeps working while always writing companyId.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await withModuleAccess('LEADS', { quota: 'leads' });
    const { companyId } = await resolveCompanyContextFromRequest(session, req);

    const formData = await req.formData();
    const csvFile = formData.get('file');

    if (!(csvFile instanceof File)) {
      throw ApiErrors.badRequest('CSV file is required');
    }

    if (csvFile.size === 0) {
      throw ApiErrors.badRequest('CSV file is empty');
    }

    const csvText = await csvFile.text();
    const employeeId =
      typeof (session.user as { employeeId?: string }).employeeId === 'string'
        ? (session.user as { employeeId?: string }).employeeId
        : undefined;

    const result = await runImport({
      object: 'leads',
      csvText,
      mapping: null,
      ctx: {
        companyId,
        userId: session.user.id,
        employeeId,
      },
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: result.summary.totalRows,
        imported: result.summary.imported,
        skippedDuplicates: result.summary.skippedDuplicates,
        skippedMissingCompany: result.summary.skippedMissingRequired,
        failed: result.summary.failed,
      },
      createdLeadIds: result.createdIds,
      errors: result.errors,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isApiException(error)) return handleApiError(error);
    const message = error instanceof Error ? error.message : 'Import failed';
    if (message.includes('limit')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (
      message.includes('CSV') ||
      message.includes('required') ||
      message.includes('mapping')
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
