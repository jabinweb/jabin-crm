import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { guardAgentFeature } from '@/lib/api/subscription-guards';
import { accessibleDocWhere } from '@/lib/crm/company-doc-scope';
import { prisma } from '@/lib/prisma';
import { quotationService } from '@/lib/crm/quotation-service';
import { validateRequest } from '@/lib/validations/server';
import { z } from 'zod';

const convertSchema = z.object({
  dueInDays: z.number().min(1).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('QUOTATIONS');
    // Converting creates an invoice — the Invoices module must be on too.
    await guardAgentFeature(session.user, 'INVOICES');
    const { id } = await params;

    const scope = await accessibleDocWhere(session, req);
    const allowed = await prisma.quotation.findFirst({ where: { id, ...scope }, select: { id: true } });
    if (!allowed) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }
    
    const { dueInDays } = await validateRequest(req, convertSchema);
    
    const invoice = await quotationService.convertToInvoice(id, dueInDays);

    return NextResponse.json(invoice);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}
