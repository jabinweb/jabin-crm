import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { invoiceService } from '@/lib/crm/invoice-service';
import { accessibleDocWhere } from '@/lib/crm/company-doc-scope';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateInvoiceSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional().transform((v) => v ?? undefined),
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  currency: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).optional(),
  dueDate: z.string().optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT', 'CANCELLED']).optional(),
  gstin: z.string().optional().nullable(),
  placeOfSupply: z.string().optional().nullable(),
  gstTaxType: z.enum(['CGST_SGST', 'IGST']).optional().nullable(),
  bankName: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  swiftCode: z.string().optional(),
  iban: z.string().optional(),
  paymentInstructions: z.string().optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional().transform((v) => v ?? undefined),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0),
        hsnSac: z.string().optional().nullable(),
      })
    )
    .optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('INVOICES');
    const { id } = await params;

    const scope = await accessibleDocWhere(session, req);
    const allowed = await prisma.invoice.findFirst({ where: { id, ...scope }, select: { id: true } });
    const invoice = allowed ? await invoiceService.getInvoice(id) : null;
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('INVOICES');
    const { id } = await params;
    const body = updateInvoiceSchema.parse(await req.json());

    // Same access as viewing: admins edit any invoice in the workspace, others their own.
    const scope = await accessibleDocWhere(session, req);
    const allowed = await prisma.invoice.findFirst({ where: { id, ...scope }, select: { id: true } });
    if (!allowed) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = await invoiceService.updateInvoice(id, null, body);
    
    return NextResponse.json(invoice);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}
