import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { invoiceService } from '@/lib/crm/invoice-service';
import { accessibleDocWhere } from '@/lib/crm/company-doc-scope';

export async function GET(req: NextRequest) {
  try {
    const session = await withModuleAccess('INVOICES');

    // Same scope as the invoice list next to the cards (workspace for admins)
    const scope = await accessibleDocWhere(session, req);
    const stats = await invoiceService.getInvoiceStats(session.user.id, scope);

    return NextResponse.json(stats);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}
