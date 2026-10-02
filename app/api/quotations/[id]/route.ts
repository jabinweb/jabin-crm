import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { accessibleDocWhere } from '@/lib/crm/company-doc-scope';
import { prisma } from '@/lib/prisma';
import { quotationService } from '@/lib/crm/quotation-service';
import { validateRequest } from '@/lib/validations/server';
import { z } from 'zod';

const updateQuotationSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  currency: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).optional(),
  validityDays: z.number().min(1).optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      quantity: z.number().min(1),
      unitPrice: z.number().min(0),
    })
  ).optional(),
});

export async function GET(
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
    
    const quotation = await quotationService.getQuotation(id);
    
    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    return NextResponse.json(quotation);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}

export async function PUT(
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
    
    const validatedData = await validateRequest(req, updateQuotationSchema);
    
    const quotation = await quotationService.updateQuotation(id, validatedData);

    return NextResponse.json(quotation);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}

export async function DELETE(
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
    
    await quotationService.deleteQuotation(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    return handleApiError(error);
  }
}
