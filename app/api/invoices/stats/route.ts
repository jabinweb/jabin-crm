import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { invoiceService } from '@/lib/invoice-service';

export async function GET(req: NextRequest) {
  try {
    const session = await withModuleAccess('INVOICES');

    const stats = await invoiceService.getInvoiceStats(session.user.id);

    return NextResponse.json(stats);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}
