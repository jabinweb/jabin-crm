import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { runAgentTurn, type AgentImageAttachment } from '@/lib/agent/runner';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role === 'CUSTOMER' || session.user.role === 'EMPLOYEE') {
      return NextResponse.json({ error: 'OPS is for CRM staff' }, { status: 403 });
    }

    const ctx = await resolveCompanyContextFromRequest(session, req);
    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const imagesRaw = Array.isArray(body.images) ? body.images : [];
    const images: AgentImageAttachment[] = imagesRaw
      .map((img: unknown) => {
        if (!img || typeof img !== 'object') return null;
        const o = img as Record<string, unknown>;
        const mimeType =
          typeof o.mimeType === 'string' ? o.mimeType : 'image/png';
        const url = typeof o.url === 'string' ? o.url : undefined;
        const data = typeof o.data === 'string' ? o.data : undefined;
        if (!url && !data) return null;
        return { mimeType, url, data };
      })
      .filter(Boolean) as AgentImageAttachment[];

    if (!message && !images.length) {
      return NextResponse.json(
        { error: 'message or image required' },
        { status: 400 }
      );
    }

    const result = await runAgentTurn({
      companyId: ctx.companyId,
      userId: session.user.id,
      userRole: String(session.user.role || 'SALES'),
      userName: session.user.name,
      threadId: typeof body.threadId === 'string' ? body.threadId : null,
      message: message || (images.length ? 'Please analyze this screenshot and take any needed actions.' : ''),
      images,
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
      return NextResponse.json({ error: 'OPS is for CRM staff' }, { status: 403 });
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
      take: 40,
      select: { id: true, title: true, updatedAt: true, createdAt: true },
    });
    return NextResponse.json({ threads });
  } catch (error) {
    console.error('[api/agent/chat GET]', error);
    return NextResponse.json({ error: 'Failed to load threads' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = await resolveCompanyContextFromRequest(session, req);
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get('threadId');
    if (!threadId) {
      return NextResponse.json({ error: 'threadId required' }, { status: 400 });
    }

    const thread = await prisma.agentThread.findFirst({
      where: { id: threadId, companyId: ctx.companyId, userId: session.user.id },
    });
    if (!thread) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.agentThread.delete({ where: { id: threadId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/agent/chat DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
