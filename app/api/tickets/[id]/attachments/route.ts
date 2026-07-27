import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';

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
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, customer: { select: { companyId: true } } },
    });
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    try {
      const ctx = await resolveCompanyContextFromRequest(session, req);
      if (
        ticket.customer.companyId &&
        ctx.companyId &&
        ticket.customer.companyId !== ctx.companyId &&
        session.user.role !== 'SUPER_ADMIN'
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      // portal customers may not have company context
    }

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
