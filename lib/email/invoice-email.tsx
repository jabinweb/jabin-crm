import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '../pdf/invoice-pdf';
import { getUserSmtpConfig } from '../smtp-config';
import { EmailService, type EmailConfig } from './email-service';
import { getAppBaseUrl } from '../app-url';
import logger from '../logger';

export async function sendInvoiceEmail(invoice: any) {
  try {
    const smtpConfig = await getUserSmtpConfig(invoice.userId);
    if (!smtpConfig) {
      throw new Error('SMTP configuration not found');
    }

    const emailConfig: EmailConfig = {
      provider: 'smtp',
      smtpHost: smtpConfig.host,
      smtpPort: smtpConfig.port,
      smtpUser: smtpConfig.user,
      smtpPassword: smtpConfig.password,
    };
    const emailService = new EmailService(emailConfig);

    // Generate PDF
    const pdfData = {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      createdAt: invoice.createdAt.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerPhone: invoice.customerPhone || undefined,
      customerAddress: invoice.customerAddress || undefined,
      items: invoice.items.map((item: any) => ({
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
      companyName: invoice.user.profile?.companyName || invoice.user.name || 'Your Company',
      companyAddress: invoice.user.profile?.companyAddress || undefined,
      companyEmail: invoice.user.profile?.companyEmail || invoice.user.email || undefined,
      companyPhone: invoice.user.profile?.companyPhone || undefined,
      companyTaxId: invoice.user.profile?.taxId || undefined,
    };

    const pdfBuffer = await renderToBuffer(<InvoicePDF invoice={pdfData} />);

    // Prepare email
    const subject = `Invoice ${invoice.invoiceNumber} - Payment Due`;
    const html = generateInvoiceEmailHTML(invoice);
    const fromName = invoice.user.profile?.companyName || invoice.user.name || 'Your Company';
    const fromEmail = invoice.user.profile?.companyEmail || invoice.user.email;

    // Send email
    const result = await emailService.sendEmail({
      to: invoice.customerEmail,
      subject,
      html,
      fromName,
      fromEmail,
      replyTo: fromEmail,
    });

    if (!result.success) {
      logger.error({ error: result.error, invoiceId: invoice.id }, 'Failed to send invoice email');
    } else {
      logger.info({ invoiceId: invoice.id, messageId: result.messageId }, 'Invoice email sent successfully');
    }

    return result;
  } catch (error) {
    logger.error({ error, invoiceId: invoice.id }, 'Error sending invoice email');
    throw error;
  }
}

function generateInvoiceEmailHTML(invoice: any): string {
  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      INR: '₹',
      AUD: 'A$',
      CAD: 'C$',
      JPY: '¥',
    };
    const symbol = symbols[currency] || currency;
    return `${symbol}${amount.toFixed(2)}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.amountDue > 0;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
        .invoice-number { background: #f3f4f6; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }
        .invoice-number strong { color: #2563eb; font-size: 18px; }
        .warning-box { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
        .warning-box strong { color: #991b1b; }
        .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .info-box strong { color: #92400e; }
        .details { margin: 20px 0; }
        .details table { width: 100%; border-collapse: collapse; }
        .details th { background: #f9fafb; padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; }
        .details td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
        .total { background: #2563eb; color: white; font-weight: bold; font-size: 18px; padding: 15px; margin-top: 10px; text-align: right; border-radius: 4px; }
        .amount-due { background: #ef4444; color: white; font-weight: bold; font-size: 20px; padding: 15px; margin-top: 10px; text-align: right; border-radius: 4px; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
        .button:hover { background: #1e40af; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 8px 8px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>💳 Invoice</h1>
        <p>Invoice from ${invoice.user.profile?.companyName || invoice.user.name}</p>
      </div>
      
      <div class="content">
        <p>Dear ${invoice.customerName},</p>
        
        <p>Thank you for your business. Please find your invoice attached.</p>
        
        <div class="invoice-number">
          <strong>Invoice #${invoice.invoiceNumber}</strong><br>
          <small>${invoice.title || 'Payment Invoice'}</small>
        </div>

        ${isOverdue ? `
          <div class="warning-box">
            <strong>⚠️ OVERDUE - Payment Required</strong><br>
            <small>This invoice was due on ${formatDate(invoice.dueDate)}. Please make payment as soon as possible.</small>
          </div>
        ` : `
          <div class="info-box">
            <strong>Due Date: ${formatDate(invoice.dueDate)}</strong><br>
            <small>Payment is due by the date mentioned above.</small>
          </div>
        `}

        <div class="details">
          <h3 style="color: #2563eb;">Invoice Details</h3>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map((item: any) => `
                <tr>
                  <td>
                    <strong>${item.name}</strong>
                    ${item.description ? `<br><small style="color: #6b7280;">${item.description}</small>` : ''}
                  </td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: right;">${formatCurrency(item.amount, invoice.currency)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="total">
          Total: ${formatCurrency(invoice.total, invoice.currency)}
        </div>

        ${invoice.amountPaid > 0 ? `
          <div style="background: #f3f4f6; padding: 15px; margin-top: 10px; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Amount Paid:</span>
              <strong style="color: #22c55e;">${formatCurrency(invoice.amountPaid, invoice.currency)}</strong>
            </div>
          </div>
          <div class="amount-due">
            Amount Due: ${formatCurrency(invoice.amountDue, invoice.currency)}
          </div>
        ` : ''}

        ${invoice.terms ? `
          <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 4px;">
            <h4 style="margin-top: 0; color: #374151;">Payment Terms</h4>
            <p style="margin: 0; font-size: 14px; color: #6b7280;">${invoice.terms}</p>
          </div>
        ` : ''}

        <p>Please review the attached PDF for complete details. If you have already made the payment, please disregard this notice.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${getAppBaseUrl()}/portal/invoices/${invoice.id}" class="button">Pay Now</a>
        </div>

        <p>For any questions regarding this invoice, please contact us.</p>

        <p>Best regards,<br>
        <strong>${invoice.user.profile?.companyName || invoice.user.name}</strong></p>
      </div>
      
      <div class="footer">
        <p>This invoice was generated automatically.</p>
        <p style="margin-top: 10px;">
          ${invoice.user.profile?.companyEmail || invoice.user.email}
          ${invoice.user.profile?.companyPhone ? ` | ${invoice.user.profile.companyPhone}` : ''}
        </p>
      </div>
    </body>
    </html>
  `;
}
