import { NextRequest, NextResponse } from 'next/server';
import { quotationService } from '@/lib/crm/quotation-service';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { renderToBuffer } from '@react-pdf/renderer';
import { QuotationPDF } from '@/lib/pdf/quotation-pdf';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await withModuleAccess('QUOTATIONS');
    const { id } = await params;
    
    const quotation = await quotationService.getQuotation(id);
    
    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    // Get company settings from user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: quotation.userId },
    });

    // Prepare data for PDF
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
      companyAddress: (userProfile as any)?.companyAddress || undefined,
      companyEmail: userProfile?.companyEmail || quotation.user.email || undefined,
      companyPhone: (userProfile as any)?.companyPhone || undefined,
      companyTaxId: (userProfile as any)?.taxId || undefined,
    };

    // Generate PDF
    const pdfBuffer = await renderToBuffer(<QuotationPDF quotation={pdfData} />);

    // Return PDF as blob
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="quotation-${quotation.quotationNumber}.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
