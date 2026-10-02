import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { leadAccessWhere, requireLeadAccess } from '@/app/api/leads/lead-access';
import { isApiException } from '@/lib/api/subscription-guards';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const leadCtx = await requireLeadAccess(request);
    const session = leadCtx.session;

    const { id } = await params;

    const lead = await prisma.lead.findFirst({ where: { id, ...leadAccessWhere(leadCtx) } });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const logs = await prisma.emailLog.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        campaign: { select: { name: true } },
        lead: {
          select: {
            activities: {
              where: { activityType: 'EMAIL_REPLIED' },
              select: { id: true, metadata: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    // Build simple reply summary per log
    const enhanced = logs.map((log: any) => {
      const replies = log.lead?.activities || [];
      let emailReplies = [] as any[];
      const normalizedSubject = (log.subject || '').toLowerCase().trim();

      if (replies.length > 0) {
        emailReplies = replies.filter((activity: any) => {
          const metadata = activity.metadata as any;
          if (!metadata) return false;
          if (log.messageId && metadata.inReplyTo === log.messageId) return true;
          const replySubject = (metadata.subject || '').toLowerCase().trim();
          const cleanReplySubject = replySubject.replace(/^re:\s*/i, '');
          return cleanReplySubject === normalizedSubject;
        });
      }

      const latestReply = emailReplies[0]
        ? {
            from: (emailReplies[0].metadata as any)?.from,
            body: (emailReplies[0].metadata as any)?.body || (emailReplies[0].metadata as any)?.preview || '',
            sentAt: emailReplies[0].createdAt,
          }
        : null;

      return {
        id: log.id,
        subject: log.subject,
        to: log.to,
        status: log.status,
        sentAt: log.sentAt,
        replyCount: emailReplies.length,
        latestReply,
      };
    });

    return NextResponse.json({ emails: enhanced });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error fetching lead emails:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
