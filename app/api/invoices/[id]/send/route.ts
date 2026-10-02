import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { accessibleDocWhere } from '@/lib/crm/company-doc-scope';
import { prisma } from '@/lib/prisma';
import { invoiceService } from '@/lib/crm/invoice-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('INVOICES');
    const { id } = await params;

    const scope = await accessibleDocWhere(session, req);
    const allowed = await prisma.invoice.findFirst({ where: { id, ...scope }, select: { id: true } });
    if (!allowed) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    
    const invoice = await invoiceService.sendInvoice(id);

    return NextResponse.json(invoice);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}
