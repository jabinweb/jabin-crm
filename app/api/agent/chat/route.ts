import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { runAgentTurn } from '@/lib/agent/runner';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role === 'CUSTOMER' || session.user.role === 'EMPLOYEE') {
      return NextResponse.json({ error: 'Ops Agent is for CRM staff' }, { status: 403 });
    }

    const ctx = await resolveCompanyContextFromRequest(session, req);
    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json({ error: 'message required' }, { status: 400 });
    }

    const result = await runAgentTurn({
      companyId: ctx.companyId,
      userId: session.user.id,
      userRole: String(session.user.role || 'SALES'),
      userName: session.user.name,
      threadId: typeof body.threadId === 'string' ? body.threadId : null,
      message,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/agent/chat]', error);
    const message = error instanceof Error ? error.message : 'Agent failed';
    const status = message.includes('API key') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role === 'CUSTOMER' || session.user.role === 'EMPLOYEE') {
      return NextResponse.json({ error: 'Ops Agent is for CRM staff' }, { status: 403 });
    }
    const ctx = await resolveCompanyContextFromRequest(session, req);
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get('threadId');

    if (threadId) {
      const messages = await prisma.agentMessage.findMany({
        where: {
          threadId,
          thread: { companyId: ctx.companyId, userId: session.user.id },
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      return NextResponse.json({ messages });
    }

    const threads = await prisma.agentThread.findMany({
      where: { companyId: ctx.companyId, userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { id: true, title: true, updatedAt: true, createdAt: true },
    });
    return NextResponse.json({ threads });
  } catch (error) {
    console.error('[api/agent/chat GET]', error);
    return NextResponse.json({ error: 'Failed to load threads' }, { status: 500 });
  }
}
