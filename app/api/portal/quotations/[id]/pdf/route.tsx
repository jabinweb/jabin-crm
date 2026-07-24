import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  portalBillingWhere,
  resolvePortalCustomerScope,
} from '@/lib/api/portal-billing-scope';
import { renderToBuffer } from '@react-pdf/renderer';
import { QuotationPDF } from '@/lib/pdf/quotation-pdf';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const scope = await resolvePortalCustomerScope(session);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const { id } = await params;
    const quotation = await prisma.quotation.findFirst({
      where: { id, ...portalBillingWhere(scope) },
      include: {
        items: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: quotation.userId },
    });

    const pdfData = {
      quotationNumber: quotation.quotationNumber,
      status: quotation.status,
      title: quotation.title,
      description: quotation.description || undefined,
      createdAt: quotation.createdAt.toISOString(),
      validUntil: quotation.validUntil.toISOString(),
      customerName: quotation.customerName,
      customerEmail: quotation.customerEmail,
      customerPhone: quotation.customerPhone || undefined,
      customerAddress: quotation.customerAddress || undefined,
      items: quotation.items.map((item) => ({
        name: item.name,
        description: item.description || undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
      subtotal: quotation.subtotal,
      taxRate: quotation.taxRate,
      taxAmount: quotation.taxAmount,
      discount: quotation.discount,
      total: quotation.total,
      currency: quotation.currency,
      terms: quotation.terms || undefined,
      notes: quotation.notes || undefined,
      companyName: userProfile?.companyName || quotation.user.name || 'Your Company',
      companyAddress: (userProfile as { companyAddress?: string })?.companyAddress || undefined,
      companyEmail: userProfile?.companyEmail || quotation.user.email || undefined,
      companyPhone: (userProfile as { companyPhone?: string })?.companyPhone || undefined,
      companyTaxId: (userProfile as { taxId?: string })?.taxId || undefined,
    };

    const pdfBuffer = await renderToBuffer(<QuotationPDF quotation={pdfData} />);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="quotation-${quotation.quotationNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[api/portal/quotations/[id]/pdf]', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
