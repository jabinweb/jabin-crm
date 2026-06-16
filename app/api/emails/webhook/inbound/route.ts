import { NextRequest, NextResponse } from 'next/server';
import { trackEmailReply, findEmailLogForReply } from '@/lib/email-logger';
import { prisma } from '@/lib/prisma';
import { handleSupportInboundEmail } from '@/lib/crm/support-email-handler';

import { verifyEmailWebhookSecret } from '@/lib/email-webhook-auth';

function verifyInboundWebhook(request: NextRequest): boolean {
  return verifyEmailWebhookSecret(request);
}

/**
 * Inbound Email Webhook
 * 
 * This endpoint receives inbound emails from your email service provider.
 * Configure this URL in your provider's inbound email settings.
 * 
 * Supported providers:
 * - SendGrid Inbound Parse
 * - Mailgun Routes
 * - Generic webhook format
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyInboundWebhook(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    let emailData: any = {};

    // Parse based on content type
    if (contentType.includes('application/json')) {
      // Generic JSON format or Mailgun
      emailData = await request.json();
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      // SendGrid Inbound Parse format
      const formData = await request.formData();
      emailData = {
        from: formData.get('from'),
        to: formData.get('to'),
        subject: formData.get('subject'),
        text: formData.get('text'),
        html: formData.get('html'),
        headers: formData.get('headers'),
      };
    }

    // Extract email fields (normalize different provider formats)
    const from = extractEmail(emailData.from || emailData.sender || emailData.From);
    const to = extractEmail(emailData.to || emailData.recipient || emailData.To);
    const subject = emailData.subject || emailData.Subject || '';
    const textBody = emailData.text || emailData['body-plain'] || emailData.Text || '';
    const htmlBody = emailData.html || emailData['body-html'] || emailData.Html || '';
    const inReplyTo = emailData['in-reply-to'] || emailData.InReplyTo || '';
    const messageId = emailData['message-id'] || emailData.MessageId || '';

    console.log('📧 Received inbound email:', {
      from,
      to,
      subject,
      inReplyTo,
      messageId,
    });

    if (!from || !subject) {
      console.error('⚠️ Missing required email fields');
      return NextResponse.json(
        { error: 'Missing required fields (from, subject)' },
        { status: 400 }
      );
    }

    // Try to find the original email this is replying to
    // Pass In-Reply-To header for precise matching via Message-ID
    const originalLog = await findEmailLogForReply(from, subject, undefined, inReplyTo);

    if (originalLog) {
      console.log('✅ Found original email log:', originalLog.id);

      // Track the reply
      await trackEmailReply(
        originalLog.id,
        subject,
        htmlBody || textBody
      );

      // Update lead activity if associated with a lead
      if (originalLog.leadId) {
        await prisma.leadActivity.create({
          data: {
            leadId: originalLog.leadId,
            activityType: 'EMAIL_REPLIED',
            description: `Received email reply: ${subject}`,
            metadata: {
              from,
              subject,
              preview: textBody?.substring(0, 200) || htmlBody?.substring(0, 200),
              messageId,
              inReplyTo,
            },
            userId: originalLog.userId,
          },
        });

        // Update lead status and last contacted date
        const lead = await prisma.lead.findUnique({
          where: { id: originalLog.leadId },
          select: { status: true },
        });

        if (lead?.status === 'NEW' || lead?.status === 'CONTACTED') {
          await prisma.lead.update({
            where: { id: originalLog.leadId },
            data: {
              status: 'RESPONDED',
              lastContactedAt: new Date(),
            },
          });
        }

        console.log('✅ Updated lead activity and status');
      }

      // If part of a campaign, update campaign stats
      if (originalLog.campaignId) {
        await prisma.emailCampaign.update({
          where: { id: originalLog.campaignId },
          data: {
            replyCount: { increment: 1 },
          },
        });

        console.log('✅ Updated campaign reply count');
      }
    } else {
      console.log('⚠️ Could not find original email for reply from:', from);

      const supportResult = await handleSupportInboundEmail({
        from,
        to,
        subject,
        textBody,
        htmlBody,
        inReplyTo,
        messageId,
      });

      if (supportResult.handled) {
        return NextResponse.json({
          success: true,
          matched: false,
          support: supportResult,
        });
      }

      console.log('📝 Unmatched inbound email (no lead or support customer):', supportResult.reason);
    }

    return NextResponse.json({
      success: true,
      matched: !!originalLog,
      logId: originalLog?.id,
    });
  } catch (error) {
    console.error('❌ Error processing inbound email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Extract email address from various formats
 * Examples: "John Doe <john@example.com>", "john@example.com"
 */
function extractEmail(emailString: string | null | undefined): string {
  if (!emailString) return '';
  
  const match = emailString.match(/<([^>]+)>/);
  if (match) {
    return match[1];
  }
  
  return emailString.trim();
}

/**
 * GET endpoint for webhook verification (some providers require this)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'active',
    endpoint: 'inbound_email_webhook',
    supported_providers: ['SendGrid', 'Mailgun', 'Generic'],
    instructions: {
      sendgrid: 'Configure in Settings > Inbound Parse',
      mailgun: 'Configure in Routes with forward action',
      generic: 'POST JSON with from, to, subject, text, html fields',
    },
  });
}
