import { NextRequest, NextResponse } from 'next/server';
import { trackEmailReply, findEmailLogForReply } from '@/lib/email-logger';
import { prisma } from '@/lib/prisma';
import { verifyEmailWebhookSecret } from '@/lib/email-webhook-auth';

/**
 * Webhook endpoint to receive email replies (SendGrid, Mailgun, etc.).
 * Public by design — no session or subscription check. Optional shared secret
 * via INBOUND_EMAIL_WEBHOOK_SECRET (same as inbound email webhook).
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyEmailWebhookSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    
    // Extract reply data (format depends on your email provider)
    // This is a generic example - adjust based on your provider
    const {
      from,           // Reply sender email
      to,             // Original sender (your email)
      subject,        // Reply subject
      text,           // Reply text body
      html,           // Reply HTML body
      inReplyTo,      // Message ID of original email
      references,     // Thread references
      headers,        // Email headers
    } = data;
    
    if (!from || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Try to find the original email log
    const originalLog = await findEmailLogForReply(from, subject);
    
    if (originalLog) {
      // Track the reply
      await trackEmailReply(
        originalLog.id,
        subject,
        html || text || ''
      );
      
      // Also update lead activity if associated with a lead
      if (originalLog.leadId) {
        await prisma.leadActivity.create({
          data: {
            leadId: originalLog.leadId,
            activityType: 'EMAIL_REPLIED',
            description: `Received email reply: ${subject}`,
            metadata: {
              from,
              subject,
              preview: text?.substring(0, 200),
            },
            userId: originalLog.userId,
          },
        });
        
        // Update lead status to RESPONDED if it's still NEW or CONTACTED
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
      }
      
      console.log(`✅ Email reply tracked for log ID: ${originalLog.id}`);
    } else {
      console.log(`⚠️ Could not find original email for reply from: ${from}`);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing email reply:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Manual reply tracking endpoint
 * Use this if you want to manually log a reply
 */
export async function PUT(request: NextRequest) {
  try {
    const { emailLogId, replySubject, replyBody } = await request.json();
    
    if (!emailLogId || !replySubject || !replyBody) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const log = await trackEmailReply(emailLogId, replySubject, replyBody);
    
    return NextResponse.json({ success: true, log });
  } catch (error) {
    console.error('Error manually tracking reply:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
