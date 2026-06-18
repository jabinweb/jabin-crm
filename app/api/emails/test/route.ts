import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sendEmail } from '@/lib/email/nodemailer';
import { createEmailLog } from '@/lib/email/email-logger';
import { getUserSmtpConfig } from '@/lib/smtp-config';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      to,
      subject,
      body,
      htmlBody,
      fromName,
      replyTo,
      testType,
    } = await request.json();

    if (!to) {
      return NextResponse.json(
        { error: 'Recipient email is required' },
        { status: 400 }
      );
    }

    // Get user's SMTP configuration
    const smtpConfig = await getUserSmtpConfig(session.user.id);
    if (!smtpConfig && (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD)) {
      return NextResponse.json(
        { error: 'Email service not configured. Please set up SMTP credentials in Settings or environment variables.' },
        { status: 500 }
      );
    }

    if (smtpConfig) {
      console.log(`Using user's custom SMTP for test email: ${smtpConfig.host}`);
    } else {
      console.log('Using default SMTP from environment for test email');
    }

    // Build email content
    let finalHtmlBody = htmlBody;
    let finalTextBody = body;

    // Add tracking if requested
    if (testType === 'tracking') {
      // We'll add tracking after creating the log
      finalHtmlBody = htmlBody || `<p>${body.replace(/\n/g, '<br>')}</p>`;
    } else if (testType === 'html' && !htmlBody) {
      finalHtmlBody = `<p>${body.replace(/\n/g, '<br>')}</p>`;
    }

    // Create email log first
    const log = await createEmailLog({
      userId: session.user.id,
      to,
      subject,
      body: finalHtmlBody || finalTextBody,
      status: 'PENDING',
      metadata: {
        testEmail: true,
        testType,
      },
    });

    // Add tracking pixel if tracking is enabled
    if (testType === 'tracking') {
      const trackingPixel = `<img src="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/emails/track/open/${log.id}" width="1" height="1" style="display:none" alt="" />`;
      finalHtmlBody = (finalHtmlBody || '') + trackingPixel;

      // Wrap links with tracking
      if (finalHtmlBody) {
        finalHtmlBody = finalHtmlBody.replace(
          /href="([^"]+)"/g,
          (_match: string, url: string) => {
            const trackedUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/emails/track/click/${log.id}?url=${encodeURIComponent(url)}`;
            return `href="${trackedUrl}"`;
          }
        );
      }
    }

    // Send the email
    try {
      const result = await sendEmail({
        to,
        subject: subject || 'Test Email',
        text: finalTextBody,
        html: finalHtmlBody,
        from: fromName
          ? `${fromName} <${smtpConfig?.from || process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com'}>`
          : undefined,
        replyTo: replyTo || undefined,
        smtpConfig: smtpConfig || undefined,
      });

      // Update log status
      const { updateEmailLogStatus } = await import('@/lib/email/email-logger');
      await updateEmailLogStatus(log.id, 'SENT');

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        logId: log.id,
      });
    } catch (emailError: any) {
      // Update log with error
      const { updateEmailLogStatus } = await import('@/lib/email/email-logger');
      await updateEmailLogStatus(log.id, 'FAILED', emailError.message);

      throw emailError;
    }
  } catch (error: any) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send test email' },
      { status: 500 }
    );
  }
}
