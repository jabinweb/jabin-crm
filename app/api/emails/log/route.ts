import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';

export async function GET(request: NextRequest) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      userId: session.user.id,
      ...(search && {
        OR: [
          { to: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(status && status !== 'all' && { status }),
    };

    // Fetch logs with pagination
    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          lead: {
            select: {
              companyName: true,
              contactName: true,
              activities: {
                where: {
                  activityType: 'EMAIL_REPLIED',
                },
                select: {
                  id: true,
                  metadata: true,
                  createdAt: true,
                },
                orderBy: {
                  createdAt: 'desc',
                },
              },
            },
          },
          campaign: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.emailLog.count({ where }),
    ]);

    // Enhance logs with reply information
    const enhancedLogs = logs.map((log: any) => {
      const replies = log.lead?.activities || [];
      
      // Debug logging
      if (log.subject.includes('Lead Generation Strategies')) {
        console.log(`[API Debug] Email "${log.subject}":`, {
          hasLead: !!log.lead,
          leadId: log.leadId,
          messageId: log.messageId,
          totalActivities: replies.length,
          replySubjects: replies.slice(0, 3).map((r: any) => (r.metadata as any)?.subject),
        });
      }
      
      // Filter replies for this email
      // Since Gmail may change Message-IDs, we match by:
      // 1. Subject contains the original subject (for Re: replies)
      // 2. OR inReplyTo matches our messageId (for exact matches)
      const normalizedSubject = log.subject.toLowerCase().trim();
      const emailReplies = replies.filter((activity: any) => {
        const metadata = activity.metadata as any;
        if (!metadata) return false;
        
        // Try exact Message-ID match first
        if (log.messageId && metadata.inReplyTo === log.messageId) {
          return true;
        }
        
        // Fall back to subject matching (handle "Re: " prefix)
        const replySubject = (metadata.subject || '').toLowerCase().trim();
        const cleanReplySubject = replySubject.replace(/^re:\s*/i, '');
        return cleanReplySubject === normalizedSubject;
      });

      const replyCount = emailReplies.length;
      const newReplyCount = emailReplies.filter((activity: any) => {
        const metadata = activity.metadata as any;
        return !metadata?.viewedAt;
      }).length;

      const latestReply = emailReplies[0] ? {
        from: (emailReplies[0].metadata as any)?.from || log.to,
        body: (emailReplies[0].metadata as any)?.body || (emailReplies[0].metadata as any)?.preview || '',
        sentAt: emailReplies[0].createdAt,
        isNew: !(emailReplies[0].metadata as any)?.viewedAt,
      } : null;

      // Debug logging
      if (log.subject.includes('Lead Generation Strategies')) {
        console.log(`[API Debug] Reply counts:`, {
          emailReplies: emailReplies.length,
          replyCount,
          newReplyCount,
          hasLatestReply: !!latestReply,
        });
      }

      return {
        ...log,
        lead: log.lead ? {
          companyName: log.lead.companyName,
          contactName: log.lead.contactName,
        } : null,
        replyCount,
        newReplyCount,
        latestReply,
      };
    });

    // Calculate stats
    const allLogs = await prisma.emailLog.findMany({
      where: { userId: session.user.id },
      select: {
        status: true,
        sentAt: true,
        openedAt: true,
        clickedAt: true,
        repliedAt: true,
      },
    });

    const stats = {
      total: allLogs.length,
      sent: allLogs.filter((l: any) => l.status === 'SENT' || l.status === 'DELIVERED' || l.status === 'OPENED' || l.status === 'CLICKED' || l.status === 'REPLIED').length,
      delivered: allLogs.filter((l: any) => l.status === 'DELIVERED' || l.status === 'OPENED' || l.status === 'CLICKED' || l.status === 'REPLIED').length,
      opened: allLogs.filter((l: any) => l.openedAt).length,
      clicked: allLogs.filter((l: any) => l.clickedAt).length,
      replied: allLogs.filter((l: any) => l.repliedAt).length,
      failed: allLogs.filter((l: any) => l.status === 'FAILED').length,
      bounced: allLogs.filter((l: any) => l.status === 'BOUNCED').length,
      openRate: 0,
      clickRate: 0,
      replyRate: 0,
    };

    const delivered = stats.delivered;
    if (delivered > 0) {
      stats.openRate = Math.round((stats.opened / delivered) * 100);
      stats.clickRate = Math.round((stats.clicked / delivered) * 100);
      stats.replyRate = Math.round((stats.replied / delivered) * 100);
    }

    return NextResponse.json({
      logs: enhancedLogs,
      stats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error fetching email logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
