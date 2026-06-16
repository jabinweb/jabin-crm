import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

type MessageThreadGroupRow = {
  senderId: string;
  receiverId: string;
};

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.employeeId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const chats = (await prisma.employeeMessage.groupBy({
      by: ['senderId', 'receiverId'],
      where: {
        OR: [
          { receiverId: session.user.employeeId },
          { senderId: session.user.employeeId }
        ]
      },
      having: {
        id: {
          _count: {
            gt: 0
          }
        }
      },
      orderBy: {
        _max: {
          createdAt: 'desc'
        }
      },
      take: 50
    })) as MessageThreadGroupRow[];

    // Get user details and unread counts
    const threads = await Promise.all(
      chats.map(async (chat: MessageThreadGroupRow) => {
        const otherUserId = chat.senderId === session.user.employeeId 
          ? chat.receiverId 
          : chat.senderId;

        const [user, lastMessage, unreadCount] = await Promise.all([
          prisma.employee.findUnique({
            where: { id: otherUserId },
            select: { id: true, name: true, avatar: true }
          }),
          prisma.employeeMessage.findFirst({
            where: {
              OR: [
                { senderId: otherUserId, receiverId: session.user.employeeId },
                { senderId: session.user.employeeId, receiverId: otherUserId }
              ]
            },
            orderBy: { createdAt: 'desc' }
          }),
          prisma.employeeMessage.count({
            where: {
              senderId: otherUserId,
              receiverId: session.user.employeeId,
              status: 'SENT'
            }
          })
        ]);

        return {
          userId: user?.id,
          name: user?.name,
          avatar: user?.avatar,
          lastMessage,
          unreadCount
        };
      })
    );

    return new Response(JSON.stringify(threads), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[API] Get message threads error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

