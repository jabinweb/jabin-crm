import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { EmployeeMessageStatus } from '@prisma/client';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.employeeId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { id: otherId } = await params;

    await prisma.employeeMessage.updateMany({
      where: {
        senderId: otherId,
        receiverId: session.user.employeeId,
        status: EmployeeMessageStatus.SENT,
      },
      data: { status: EmployeeMessageStatus.DELIVERED },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[api/chats/[id]/read POST]', error);
    return new Response(JSON.stringify({ error: 'Failed to mark as read' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
