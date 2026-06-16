import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { emailId } = await params;

    // Get the email log to verify ownership
    const emailLog = await prisma.emailLog.findFirst({
      where: {
        id: emailId,
        userId: session.user.id,
      },
      select: {
        id: true,
        leadId: true,
        to: true,
        subject: true,
        messageId: true, // Need this to match replies via inReplyTo
      },
    });

    if (!emailLog) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Fetch all reply activities for this lead
    // Then filter in JavaScript to match this specific email's messageId
    const allReplies = emailLog.leadId
      ? await prisma.leadActivity.findMany({
          where: {
            leadId: emailLog.leadId,
            activityType: 'EMAIL_REPLIED',
            userId: session.user.id,
          },
          orderBy: {
            createdAt: 'asc', // Oldest first for thread view
          },
          select: {
            id: true,
            description: true,
            metadata: true,
            createdAt: true,
          },
        })
      : [];

    // Filter replies that are actually for THIS email using inReplyTo
    // Build the full thread by including replies to replies
    const replies: any[] = [];
    if (emailLog.messageId) {
      // First, find direct replies to this email
      const directReplies = allReplies.filter((reply: any) => 
        reply.metadata?.inReplyTo === emailLog.messageId
      );
      
      // Add direct replies
      replies.push(...directReplies);
      
      // Then find replies to those replies (thread chain)
      const replyMessageIds = new Set<string>(directReplies.map((r: any) => r.metadata?.messageId as string));
      
      const findThreadReplies = (parentIds: Set<string>) => {
        const threadReplies = allReplies.filter((reply: any) => 
          parentIds.has(reply.metadata?.inReplyTo) && 
          !replies.some(r => r.id === reply.id) // Don't add duplicates
        );
        
        if (threadReplies.length > 0) {
          replies.push(...threadReplies);
          // Recursively find replies to these replies
          const newParentIds = new Set<string>(threadReplies.map((r: any) => r.metadata?.messageId as string));
          findThreadReplies(newParentIds);
        }
      };
      
      findThreadReplies(replyMessageIds);
    } else {
      replies.push(...allReplies);
    }

    // Transform replies to a consistent format
    const formattedReplies = replies.map((reply: any) => ({
      id: reply.id,
      from: reply.metadata?.from || emailLog.to,
      subject: reply.metadata?.subject || reply.description,
      body: reply.metadata?.body || reply.metadata?.preview || '', // Use full body, fallback to preview
      sentAt: reply.createdAt,
      messageId: reply.metadata?.messageId,
      inReplyTo: reply.metadata?.inReplyTo,
      viewedAt: reply.metadata?.viewedAt || null, // Track when reply was viewed
      isNew: !reply.metadata?.viewedAt, // Reply is new if never viewed
    }));

    return NextResponse.json({
      email: {
        id: emailLog.id,
        to: emailLog.to,
        subject: emailLog.subject,
      },
      replies: formattedReplies,
      count: formattedReplies.length,
    });
  } catch (error) {
    console.error('Error fetching email replies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
