import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  portalBillingWhere,
  resolvePortalCustomerScope,
} from '@/lib/api/portal-billing-scope';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '@/lib/pdf/invoice-pdf';

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
    const invoice = await prisma.invoice.findFirst({
      where: { id, ...portalBillingWhere(scope) },
      include: {
        items: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: invoice.userId },
    });

    let paymentDetails: Record<string, string> = {};
    if (invoice.paymentDetails) {
      try {
        paymentDetails = JSON.parse(invoice.paymentDetails);
      } catch {
        paymentDetails = {};
      }
    }

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
      companyAddress: (userProfile as { companyAddress?: string })?.companyAddress || undefined,
      companyEmail: userProfile?.companyEmail || invoice.user.email || undefined,
      companyPhone: (userProfile as { companyPhone?: string })?.companyPhone || undefined,
      companyTaxId: (userProfile as { taxId?: string })?.taxId || undefined,
      bankName: paymentDetails.bankName || undefined,
      accountName: paymentDetails.accountName || undefined,
      accountNumber: paymentDetails.accountNumber || undefined,
      routingNumber: paymentDetails.routingNumber || undefined,
      swiftCode: paymentDetails.swiftCode || undefined,
      iban: paymentDetails.iban || undefined,
      paymentInstructions: paymentDetails.paymentInstructions || undefined,
    };

    const pdfBuffer = await renderToBuffer(<InvoicePDF invoice={pdfData} />);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[api/portal/invoices/[id]/pdf]', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
