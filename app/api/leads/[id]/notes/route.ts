import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { leadAccessWhere, requireLeadAccess } from '@/app/api/leads/lead-access';
import { isApiException } from '@/lib/api/subscription-guards';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const leadCtx = await requireLeadAccess(request);
    const session = leadCtx.session;

    const resolvedParams = await params;
    const { note } = await request.json();

    if (!note || !note.trim()) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: resolvedParams.id, ...leadAccessWhere(leadCtx) },
      select: { id: true },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Update lead with note
    await prisma.lead.update({
      where: { id: resolvedParams.id },
      data: { 
        notes: note,
        updatedAt: new Date(),
      },
    });

    // Create activity log
    const activity = await prisma.leadActivity.create({
      data: {
        leadId: resolvedParams.id,
        activityType: 'NOTE_ADDED',
        description: note,
        userId: session.user.id,
      },
    });

    return NextResponse.json(activity);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error adding note:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
