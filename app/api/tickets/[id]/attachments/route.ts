import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { requireTicketRouteAccess } from '@/lib/tenant/ticket-route-guard';

function isHttpUrl(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const guard = await requireTicketRouteAccess(session, req, id);
    if (!guard.ok) return guard.response;

    const attachments = await prisma.ticketAttachment.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ attachments });
  } catch (error) {
    console.error('[ticket attachments GET]', error);
    return NextResponse.json({ error: 'Failed to load attachments' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const { url, fileName, contentType } = body as {
      url?: string;
      fileName?: string;
      contentType?: string;
    };
    if (!url || typeof url !== 'string' || !isHttpUrl(url)) {
      return NextResponse.json({ error: 'A valid http(s) url is required' }, { status: 400 });
    }

    const guard = await requireTicketRouteAccess(session, req, id);
    if (!guard.ok) return guard.response;

    const attachment = await prisma.ticketAttachment.create({
      data: {
        ticketId: id,
        url,
        fileName: fileName || null,
        contentType: contentType || null,
        uploadedById: session.user.id,
      },
    });

    await prisma.ticketActivity.create({
      data: {
        ticketId: id,
        eventType: 'ATTACHMENT',
        description: `Photo evidence uploaded${fileName ? `: ${fileName}` : ''}`,
        performedById: session.user.id,
        metadata: { attachmentId: attachment.id, url },
      },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error('[ticket attachments POST]', error);
    return NextResponse.json({ error: 'Failed to save attachment' }, { status: 500 });
  }
}
