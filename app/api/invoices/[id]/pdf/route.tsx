import { NextRequest, NextResponse } from 'next/server';
import { invoiceService } from '@/lib/crm/invoice-service';
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
        hsnSac: (item as { hsnSac?: string | null }).hsnSac || undefined,
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
      gstin: (invoice as { gstin?: string | null }).gstin || undefined,
      placeOfSupply: (invoice as { placeOfSupply?: string | null }).placeOfSupply || undefined,
      taxBreakup: ((invoice as { taxBreakup?: unknown }).taxBreakup as {
        cgst?: number;
        sgst?: number;
        igst?: number;
      } | null) || undefined,
      companyName: userProfile?.companyName || invoice.user.name || 'Your Company',
      companyAddress: userProfile?.companyAddress || undefined,
      companyEmail: userProfile?.companyEmail || invoice.user.email || undefined,
      companyPhone: userProfile?.companyPhone || undefined,
      companyTaxId: userProfile?.taxId || (invoice as { gstin?: string | null }).gstin || undefined,
      // Template branding (from Personal settings → Templates)
      templateStyle: userProfile?.templateStyle || undefined,
      primaryColor: userProfile?.primaryColor || undefined,
      secondaryColor: userProfile?.secondaryColor || undefined,
      logoUrl: userProfile?.logoUrl || undefined,
      headerText: userProfile?.headerText || undefined,
      footerText: userProfile?.footerText || undefined,
      // Payment details
      bankName: paymentDetails.bankName || userProfile?.bankName || undefined,
      accountName: paymentDetails.accountName || userProfile?.accountName || undefined,
      accountNumber: paymentDetails.accountNumber || userProfile?.accountNumber || undefined,
      routingNumber: paymentDetails.routingNumber || userProfile?.routingNumber || undefined,
      swiftCode: paymentDetails.swiftCode || userProfile?.swiftCode || undefined,
      iban: paymentDetails.iban || userProfile?.iban || undefined,
      paymentInstructions:
        paymentDetails.paymentInstructions || userProfile?.paymentInstructions || undefined,
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
