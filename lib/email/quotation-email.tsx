import { renderToBuffer } from '@react-pdf/renderer';
import { QuotationPDF } from '../pdf/quotation-pdf';
import { getUserSmtpConfig } from '../smtp-config';
import { EmailService, type EmailConfig } from './email-service';
import { getAppBaseUrl } from '../app-url';
import logger from '../logger';

export async function sendQuotationEmail(quotation: any) {
  try {
    const smtpConfig = await getUserSmtpConfig(quotation.userId);
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
      items: quotation.items.map((item: any) => ({
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
      companyName: quotation.user.profile?.companyName || quotation.user.name || 'Your Company',
      companyAddress: quotation.user.profile?.companyAddress || undefined,
      companyEmail: quotation.user.profile?.companyEmail || quotation.user.email || undefined,
      companyPhone: quotation.user.profile?.companyPhone || undefined,
      companyTaxId: quotation.user.profile?.taxId || undefined,
    };

    const pdfBuffer = await renderToBuffer(<QuotationPDF quotation={pdfData} />);

    // Prepare email
    const subject = `Quotation ${quotation.quotationNumber} - ${quotation.title}`;
    const html = generateQuotationEmailHTML(quotation);
    const fromName = quotation.user.profile?.companyName || quotation.user.name || 'Your Company';
    const fromEmail = quotation.user.profile?.companyEmail || quotation.user.email;

    // Send email
    const result = await emailService.sendEmail({
      to: quotation.customerEmail,
      subject,
      html,
      fromName,
      fromEmail,
      replyTo: fromEmail,
    });

    if (!result.success) {
      logger.error({ error: result.error, quotationId: quotation.id }, 'Failed to send quotation email');
    } else {
      logger.info({ quotationId: quotation.id, messageId: result.messageId }, 'Quotation email sent successfully');
    }

    return result;
  } catch (error) {
    logger.error({ error, quotationId: quotation.id }, 'Error sending quotation email');
    throw error;
  }
}

function generateQuotationEmailHTML(quotation: any): string {
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

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
        .quotation-number { background: #f3f4f6; padding: 15px; border-left: 4px solid #7c3aed; margin: 20px 0; }
        .quotation-number strong { color: #7c3aed; font-size: 18px; }
        .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .info-box strong { color: #92400e; }
        .details { margin: 20px 0; }
        .details table { width: 100%; border-collapse: collapse; }
        .details th { background: #f9fafb; padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; }
        .details td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
        .total { background: #7c3aed; color: white; font-weight: bold; font-size: 18px; padding: 15px; margin-top: 10px; text-align: right; border-radius: 4px; }
        .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
        .button:hover { background: #6d28d9; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 8px 8px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📋 New Quotation</h1>
        <p>You've received a quotation from ${quotation.user.profile?.companyName || quotation.user.name}</p>
      </div>
      
      <div class="content">
        <p>Dear ${quotation.customerName},</p>
        
        <p>Thank you for your interest. Please find attached our quotation for your review.</p>
        
        <div class="quotation-number">
          <strong>Quotation #${quotation.quotationNumber}</strong><br>
          <small>${quotation.title}</small>
        </div>

        <div class="info-box">
          <strong>⚠️ Valid Until: ${formatDate(quotation.validUntil)}</strong><br>
          <small>This quotation expires on the date mentioned above.</small>
        </div>

        <div class="details">
          <h3 style="color: #7c3aed;">Quotation Details</h3>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${quotation.items.map((item: any) => `
                <tr>
                  <td>
                    <strong>${item.name}</strong>
                    ${item.description ? `<br><small style="color: #6b7280;">${item.description}</small>` : ''}
                  </td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: right;">${formatCurrency(item.amount, quotation.currency)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="total">
          Total: ${formatCurrency(quotation.total, quotation.currency)}
        </div>

        ${quotation.terms ? `
          <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 4px;">
            <h4 style="margin-top: 0; color: #374151;">Terms & Conditions</h4>
            <p style="margin: 0; font-size: 14px; color: #6b7280;">${quotation.terms}</p>
          </div>
        ` : ''}

        <p>Please review the attached PDF for complete details. If you have any questions or would like to proceed, please don't hesitate to contact us.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${getAppBaseUrl()}/portal/quotations/${quotation.id}" class="button">Review Quotation</a>
        </div>

        <p>Best regards,<br>
        <strong>${quotation.user.profile?.companyName || quotation.user.name}</strong></p>
      </div>
      
      <div class="footer">
        <p>This quotation was generated automatically.</p>
        <p style="margin-top: 10px;">
          ${quotation.user.profile?.companyEmail || quotation.user.email}
          ${quotation.user.profile?.companyPhone ? ` | ${quotation.user.profile.companyPhone}` : ''}
        </p>
      </div>
    </body>
    </html>
  `;
}
