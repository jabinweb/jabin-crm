import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors, handleApiError } from '@/lib/api-error-handler';
import { accessibleDocWhere } from '@/lib/crm/company-doc-scope';
import { prisma } from '@/lib/prisma';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { invoiceService } from '@/lib/crm/invoice-service';
import { validateRequest } from '@/lib/validations/server';
import { z } from 'zod';

const createInvoiceSchema = z.object({
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  customerId: z.string().optional(),
  projectId: z.string().optional(),
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
  dueDate: z.string().optional(),
  paymentMethod: z.string().optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  gstin: z.string().optional().nullable(),
  placeOfSupply: z.string().optional().nullable(),
  gstTaxType: z.enum(['CGST_SGST', 'IGST']).optional().nullable(),
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
      hsnSac: z.string().optional().nullable(),
    })
  ).min(1, 'At least one item is required'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await withModuleAccess('INVOICES');

    const validatedData = await validateRequest(req, createInvoiceSchema);

    let companyId: string | undefined;
    try {
      const { resolveCompanyContextFromRequest } = await import('@/lib/auth/company-membership');
      companyId = (await resolveCompanyContextFromRequest(session, req)).companyId;
    } catch {
      /* no workspace context */
    }

    if (validatedData.quotationId) {
      const scope = await accessibleDocWhere(session, req);
      const quotation = await prisma.quotation.findFirst({
        where: { id: validatedData.quotationId, ...scope },
        select: { id: true, status: true, invoice: { select: { id: true } } },
      });
      if (!quotation) throw ApiErrors.notFound('Quotation');
      if (quotation.invoice) throw ApiErrors.conflict('Quotation already converted to invoice');
      if (quotation.status !== 'ACCEPTED') {
        throw ApiErrors.badRequest('Only accepted quotations can be converted to invoices');
      }
    }

    const invoice = await invoiceService.createInvoice({
      ...validatedData,
      userId: session.user.id,
      companyId,
    });

    if (validatedData.quotationId) {
      await prisma.quotation.update({
        where: { id: validatedData.quotationId },
        data: { status: 'CONVERTED' },
      });
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}

const listInvoicesSchema = z.object({
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  customerId: z.string().optional(),
  projectId: z.string().optional(),
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

    let companyId: string | undefined;
    if (session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') {
      try {
        const { resolveCompanyContextFromRequest } = await import(
          '@/lib/auth/company-membership'
        );
        const ctx = await resolveCompanyContextFromRequest(session, req);
        companyId = ctx.companyId;
      } catch {
        /* user-scoped */
      }
    }

    const result = await invoiceService.listInvoices({
      userId: companyId ? undefined : session.user.id,
      companyId,
      ...validatedParams,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}
