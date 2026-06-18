import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { withModuleAccess, afterEmailSent } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';
import { sendEmail, createEmailHTML } from '@/lib/email/nodemailer';
import { createEmailLog, updateEmailLogStatus } from '@/lib/email/email-logger';
import { getUserSmtpConfig } from '@/lib/smtp-config';

export async function POST(request: NextRequest) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH', { quota: 'emails' });

    const body = await request.json();
    const { draftId, to, subject, body: emailBody, leadId, campaignId } = body;

    // Handle direct email sending (without draft)
    if (!draftId && to && subject && emailBody) {
      console.log(`Sending direct email to ${to} with subject: ${subject}`);

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }

      // Create email log first
      const log = await createEmailLog({
        userId: session.user.id,
        leadId,
        campaignId,
        to,
        subject,
        body: emailBody,
        status: 'PENDING',
      });

      console.log(`Created email log: ${log.id}`);

      // Get user's SMTP configuration
      const smtpConfig = await getUserSmtpConfig(session.user.id);
      if (smtpConfig) {
        console.log(`Using user's custom SMTP: ${smtpConfig.host}`);
      } else {
        console.log('Using default SMTP from environment');
      }

      // Send the email
      try {
        const emailHTML = createEmailHTML(emailBody);
        
        const result = await sendEmail({
          to,
          subject,
          html: emailHTML,
          text: emailBody.replace(/<[^>]*>/g, ''), // Strip HTML for plain text
          smtpConfig: smtpConfig || undefined,
        });

        console.log(`Email sent successfully: ${result.messageId}`);

        // Update log status to SENT and store messageId for reply matching
        await prisma.emailLog.update({
          where: { id: log.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            messageId: result.messageId, // Store Message-ID for precise reply matching
          },
        });

        // Update lead activity if leadId is provided
        if (leadId) {
          await prisma.leadActivity.create({
            data: {
              leadId,
              activityType: 'EMAIL_SENT',
              description: `Email sent: ${subject}`,
              metadata: {
                subject,
                to,
                messageId: result.messageId,
              },
              userId: session.user.id,
            },
          });

          // Update lead status to CONTACTED if it's still NEW
          const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { status: true },
          });

          if (lead?.status === 'NEW') {
            await prisma.lead.update({
              where: { id: leadId },
              data: {
                status: 'CONTACTED',
                lastContactedAt: new Date(),
              },
            });
          }

          console.log(`Updated lead activity for lead: ${leadId}`);
        }

        // Update campaign stats if campaignId is provided
        if (campaignId) {
          await prisma.emailCampaign.update({
            where: { id: campaignId },
            data: {
              sentCount: { increment: 1 },
            },
          });
          console.log(`Updated campaign stats for campaign: ${campaignId}`);
        }

        await afterEmailSent(session.user.id);

        return NextResponse.json({
          success: true,
          messageId: result.messageId,
          logId: log.id,
        });
      } catch (emailError: any) {
        console.error('Error sending email:', emailError);
        
        // Update log with error
        await updateEmailLogStatus(log.id, 'FAILED', emailError.message);

        // Handle specific SMTP errors with helpful messages
        if (emailError.code === 'EAUTH') {
          return NextResponse.json(
            {
              error: 'Gmail Authentication Failed',
              message: 'Gmail requires an App Password (not your regular password). Go to Email Settings to update.',
              details: emailError.message,
            },
            { status: 401 }
          );
        }

        if (emailError.code === 'ECONNECTION' || emailError.code === 'ESOCKET') {
          return NextResponse.json(
            {
              error: 'Connection Failed',
              message: 'Cannot connect to SMTP server. Check your host, port, and SSL settings.',
              details: emailError.message,
            },
            { status: 500 }
          );
        }

        return NextResponse.json(
          {
            error: 'Failed to send email',
            message: emailError.message || 'Unknown error occurred',
            code: emailError.code,
          },
          { status: 500 }
        );
      }
    }

    // Handle draft-based email sending (existing logic)
    if (!draftId) {
      return NextResponse.json({ error: 'Draft ID or email details required' }, { status: 400 });
    }

    // Fetch the draft
    const draft = await prisma.emailDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Verify ownership
    if (draft.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if already sent
    if (draft.status === 'SENT') {
      return NextResponse.json({ error: 'Email already sent' }, { status: 400 });
    }

    // Validate recipient email
    if (!draft.recipientEmail) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(draft.recipientEmail)) {
      return NextResponse.json({ error: 'Invalid recipient email format' }, { status: 400 });
    }

    // Check SMTP configuration (either user's or default)
    const smtpConfig = await getUserSmtpConfig(session.user.id);
    if (!smtpConfig && (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD)) {
      return NextResponse.json({ 
        error: 'Email service not configured. Please set up SMTP credentials in Settings or environment variables.' 
      }, { status: 500 });
    }

    console.log(`Sending draft email (ID: ${draftId}) to ${draft.recipientEmail}`);
    if (smtpConfig) {
      console.log(`Using user's custom SMTP: ${smtpConfig.host}`);
    }

    // Create email log first
    const log = await createEmailLog({
      userId: session.user.id,
      leadId: draft.leadId || undefined,
      to: draft.recipientEmail,
      subject: draft.subject,
      body: draft.body,
      status: 'PENDING',
    });

    console.log(`Created email log: ${log.id}`);

    // Create HTML email
    const emailHTML = createEmailHTML(draft.body);

    // Send email
    try {
      const result = await sendEmail({
        to: draft.recipientEmail,
        subject: draft.subject,
        html: emailHTML,
        text: draft.body,
        smtpConfig: smtpConfig || undefined,
      });

      console.log(`Email sent successfully: ${result.messageId}`);

      // Update log status to SENT and store messageId
      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          messageId: result.messageId, // Store Message-ID for precise reply matching
        },
      });

      // Update draft status to SENT
      await prisma.emailDraft.update({
        where: { id: draftId },
        data: { 
          status: 'SENT',
          updatedAt: new Date(),
        },
      });

      // If leadId exists, update lead activity and status
      if (draft.leadId) {
        try {
          await prisma.leadActivity.create({
            data: {
              leadId: draft.leadId,
              activityType: 'EMAIL_SENT',
              description: `Email sent: ${draft.subject}`,
              metadata: {
                subject: draft.subject,
                to: draft.recipientEmail,
                messageId: result.messageId,
              },
              userId: session.user.id,
            },
          });

          const lead = await prisma.lead.findUnique({
            where: { id: draft.leadId },
            select: { status: true },
          });

          if (lead?.status === 'NEW') {
            await prisma.lead.update({
              where: { id: draft.leadId },
              data: {
                lastContactedAt: new Date(),
                status: 'CONTACTED',
              },
            });
          }

          console.log(`Updated lead activity for lead: ${draft.leadId}`);
        } catch (error) {
          console.error('Failed to update lead:', error);
          // Don't fail the request if lead update fails
        }
      }

      await afterEmailSent(session.user.id);

      return NextResponse.json({ 
        success: true, 
        message: 'Email sent successfully',
        messageId: result.messageId,
        logId: log.id,
      });
    } catch (emailError: any) {
      console.error('Error sending draft email:', emailError);
      
      // Update log with error
      await updateEmailLogStatus(log.id, 'FAILED', emailError.message);
      
      // Handle specific nodemailer errors with helpful messages
      if (emailError.code === 'EAUTH') {
        return NextResponse.json({ 
          error: 'Gmail Authentication Failed',
          message: 'Gmail requires an App Password (not your regular password). Go to Email Settings to update.',
          details: emailError.message,
        }, { status: 401 });
      }
      
      if (emailError.code === 'ECONNECTION' || emailError.code === 'ESOCKET') {
        return NextResponse.json({ 
          error: 'Connection Failed',
          message: 'Cannot connect to SMTP server. Check your host, port, and SSL settings.',
          details: emailError.message,
        }, { status: 500 });
      }

      return NextResponse.json({ 
        error: 'Failed to send email',
        message: emailError.message || 'Unknown error occurred',
        code: emailError.code,
      }, { status: 500 });
    }

  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error in send email API:', error);
    }
    return handleApiError(error);
  }
}
