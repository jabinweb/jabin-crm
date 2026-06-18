import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
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
    await withModuleAccess('QUOTATIONS');
    const { id } = await params;
    
    const { dueInDays } = await validateRequest(req, convertSchema);
    
    const invoice = await quotationService.convertToInvoice(id, dueInDays);

    return NextResponse.json(invoice);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}
