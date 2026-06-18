import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { invoiceService } from '@/lib/crm/invoice-service';
import { validateRequest } from '@/lib/validations/server';
import { z } from 'zod';

const paymentSchema = z.object({
  amount: z.number().min(0.01, 'Payment amount must be greater than 0'),
  paymentMethod: z.string().optional(),
  paymentDetails: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await withModuleAccess('INVOICES');
    const { id } = await params;
    
    const validatedData = await validateRequest(req, paymentSchema);
    
    const invoice = await invoiceService.recordPayment(id, validatedData);

    return NextResponse.json(invoice);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}
