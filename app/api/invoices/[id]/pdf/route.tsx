import { NextRequest, NextResponse } from 'next/server';
import { invoiceService } from '@/lib/invoice-service';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '@/lib/pdf/invoice-pdf';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await withModuleAccess('INVOICES');
    const { id } = await params;
    
    const invoice = await invoiceService.getInvoice(id);
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get company settings from user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: invoice.userId },
    });

    // Parse payment details if available
    let paymentDetails: any = {};
    if (invoice.paymentDetails) {
      try {
        paymentDetails = JSON.parse(invoice.paymentDetails);
      } catch (e) {
        // Invalid JSON, ignore
      }
    }

    // Prepare data for PDF
    const pdfData = {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      createdAt: invoice.createdAt.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerPhone: invoice.customerPhone || undefined,
      customerAddress: invoice.customerAddress || undefined,
      items: invoice.items.map((item) => ({
        name: item.name,
        description: item.description || undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
      subtotal: invoice.subtotal,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      discount: invoice.discount,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      amountDue: invoice.amountDue,
      currency: invoice.currency,
      terms: invoice.terms || undefined,
      notes: invoice.notes || undefined,
      companyName: userProfile?.companyName || invoice.user.name || 'Your Company',
      companyAddress: (userProfile as any)?.companyAddress || undefined,
      companyEmail: userProfile?.companyEmail || invoice.user.email || undefined,
      companyPhone: (userProfile as any)?.companyPhone || undefined,
      companyTaxId: (userProfile as any)?.taxId || undefined,
      // Payment details
      bankName: paymentDetails.bankName || undefined,
      accountName: paymentDetails.accountName || undefined,
      accountNumber: paymentDetails.accountNumber || undefined,
      routingNumber: paymentDetails.routingNumber || undefined,
      swiftCode: paymentDetails.swiftCode || undefined,
      iban: paymentDetails.iban || undefined,
      paymentInstructions: paymentDetails.paymentInstructions || undefined,
    };

    // Generate PDF
    const pdfBuffer = await renderToBuffer(<InvoicePDF invoice={pdfData} />);

    // Return PDF as blob
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
