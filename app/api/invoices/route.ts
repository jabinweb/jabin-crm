import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { invoiceService } from '@/lib/invoice-service';
import { validateRequest } from '@/lib/validation';
import { z } from 'zod';

const createInvoiceSchema = z.object({
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  quotationId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email('Invalid email address'),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  currency: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).optional(),
  dueInDays: z.number().min(1).optional(),
  paymentMethod: z.string().optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  // Payment details
  bankName: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  swiftCode: z.string().optional(),
  iban: z.string().optional(),
  paymentInstructions: z.string().optional(),
  items: z.array(
    z.object({
      name: z.string().min(1, 'Item name is required'),
      description: z.string().optional(),
      quantity: z.number().min(1, 'Quantity must be at least 1'),
      unitPrice: z.number().min(0, 'Unit price must be positive'),
    })
  ).min(1, 'At least one item is required'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await withModuleAccess('INVOICES');

    const validatedData = await validateRequest(req, createInvoiceSchema);
    
    const invoice = await invoiceService.createInvoice({
      ...validatedData,
      userId: session.user.id,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}

const listInvoicesSchema = z.object({
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']).optional(),
  overdue: z.string().optional().transform(val => val === 'true'),
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
});

export async function GET(req: NextRequest) {
  try {
    const session = await withModuleAccess('INVOICES');

    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const validatedParams = listInvoicesSchema.parse(searchParams);
    
    const result = await invoiceService.listInvoices({
      userId: session.user.id,
      ...validatedParams,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}
