import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { accessibleDocWhere } from '@/lib/crm/company-doc-scope';
import { prisma } from '@/lib/prisma';
import { quotationService } from '@/lib/crm/quotation-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('QUOTATIONS');
    const { id } = await params;

    const scope = await accessibleDocWhere(session, req);
    const allowed = await prisma.quotation.findFirst({ where: { id, ...scope }, select: { id: true } });
    if (!allowed) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }
    
    const quotation = await quotationService.sendQuotation(id);

    return NextResponse.json(quotation);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}
