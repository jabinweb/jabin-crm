import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { guardAgentFeature, isApiException } from '@/lib/api/subscription-guards';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await guardAgentFeature(session.user as { id: string; role?: string }, 'LEADS');

    const { id } = await params;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.userId !== session.user.id) {
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
