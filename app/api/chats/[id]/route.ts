import { NextRequest } from 'next/server';
import { auth } from '@/auth';import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.employeeId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { id: otherId } = await params;

    const messages = await prisma.employeeMessage.findMany({
      where: {
        OR: [
          { senderId: session.user.employeeId, receiverId: otherId },
          { senderId: otherId, receiverId: session.user.employeeId }
        ]
      },
      orderBy: { createdAt: 'asc' }, // Changed to ascending order
      take: 50,
      select: {
        id: true,
        content: true,
        senderId: true,
        receiverId: true,
        status: true,
        createdAt: true
      }
    });

    // Return messages array directly
    return new Response(JSON.stringify(messages), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('[API] Get messages error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch messages' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.employeeId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { content } = await request.json();
    const { id: receiverId } = await params;

    const message = await prisma.employeeMessage.create({
      data: {
        content,
        senderId: session.user.employeeId,
        receiverId,
        status: 'SENT',
      }
    });

    return new Response(JSON.stringify(message), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[API] Send message error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
